import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Stripe from 'stripe';

const app = new Hono();

app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
}));

function getStripe(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(), // Cloudflare Workers ke liye zaroori
  });
}

// Cart -> Order conversion (shared helper, /webhook/stripe se call hota hai)
async function createOrderFromCart(db, userId, paymentMethod, stripeSessionId) {
  const { results: cartItems } = await db.prepare(`
    SELECT product_id, name, price, image, quantity
    FROM cart WHERE user_id = ?
  `).bind(String(userId)).all();

  if (!cartItems || cartItems.length === 0) return null;

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity), 0
  );
  const shippingCost = subtotal > 0 ? 10.0 : 0;
  const total = subtotal + shippingCost;
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const orderInsert = await db.prepare(`
    INSERT INTO orders (order_number, user_id, subtotal, shipping, total, status, payment_method, stripe_session_id)
    VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)
  `).bind(orderNumber, String(userId), subtotal, shippingCost, total, paymentMethod || "card", stripeSessionId || null).run();

  const orderId = orderInsert.meta.last_row_id;

  const itemStatements = cartItems.map((item) =>
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, price, image, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(orderId, item.product_id, item.name, item.price, item.image, item.quantity, Number(item.price) * Number(item.quantity))
  );

  const deleteCartStatement = db.prepare(`DELETE FROM cart WHERE user_id = ?`).bind(String(userId));

  await db.batch([...itemStatements, deleteCartStatement]);

  return { id: orderId, orderNumber, subtotal, shipping: shippingCost, total, itemsCount: cartItems.length };
}

app.get('/', (c) => c.text('Cart Worker is live!'));

// ---- CART ROUTES ----

// 1. ADD / UPDATE CART ITEM ROUTE
app.post('/cart/add', async (c) => {
  try {
    const { userId, productId, quantity, name, price, image } = await c.req.json();
    if (!userId || !productId) {
      return c.json({ success: false, error: "UserId and ProductId are required!" }, 400);
    }
    const qty = Number(quantity) !== 0 && Number.isFinite(Number(quantity)) ? Number(quantity) : 1;
    const productPrice = Number(price) || 0;
    const productImage = image || "";
    const db = c.env.DB;

    await db.prepare(`
      INSERT INTO cart (user_id, product_id, quantity, name, price, image) 
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, product_id) 
      DO UPDATE SET 
        quantity = cart.quantity + excluded.quantity,
        name = excluded.name,
        price = excluded.price,
        image = excluded.image
    `).bind(String(userId), String(productId), qty, name || "", productPrice, productImage).run();

    await db.prepare(`
      DELETE FROM cart WHERE user_id = ? AND product_id = ? AND quantity <= 0
    `).bind(String(userId), String(productId)).run();

    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();

    return c.json({ success: true, message: "Cart successfully updated!", items: results || [] });
  } catch (error) {
    console.error("Error in /cart/add:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. GET ALL CART ITEMS ROUTE
app.get('/cart', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ success: false, error: "userId query parameter zaroori hai!" }, 400);
    const db = c.env.DB;
    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();
    return c.json({ success: true, items: results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. REMOVE ITEM ROUTE
// FIX: userId/productId ko String() se bind nahi kiya ja raha tha, jabke
// /cart/add hamesha String(userId) store karta hai. Number vs string
// mismatch ki wajah se DELETE aur uske baad wali SELECT dono hi kisi row
// ko match nahi kar pati thi - isliye hamesha items: [] wapis aata tha,
// chahe baaki products DB mein mojood hi kyun na hon.
app.delete('/cart/remove', async (c) => {
  try {
    const { userId, productId } = await c.req.json();
    if (!userId || !productId) {
      return c.json({ success: false, error: "userId aur productId zaroori hain!" }, 400);
    }
    const db = c.env.DB;
    await db.prepare("DELETE FROM cart WHERE user_id = ? AND product_id = ?")
      .bind(String(userId), String(productId))
      .run();
    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();
    return c.json({ success: true, message: "Item cart se remove ho gaya!", items: results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. GET CART COUNT ROUTE
app.get('/cart/count', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ success: false, error: "userId query parameter zaroori hai!" }, 400);
    const db = c.env.DB;
    const result = await db.prepare(
      "SELECT SUM(quantity) as totalCount FROM cart WHERE user_id = ?"
    ).bind(String(userId)).first();
    return c.json({ success: true, count: result?.totalCount || 0 });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ---- STRIPE CHECKOUT ----

// Step 1: Stripe Checkout Session banayein aur uska URL frontend ko de dein
app.post('/create-checkout-session', async (c) => {
  try {
    const { userId, successUrl, cancelUrl } = await c.req.json();
    if (!userId) return c.json({ success: false, error: "userId zaroori hai!" }, 400);

    const db = c.env.DB;
    const { results: cartItems } = await db.prepare(`
      SELECT product_id, name, price, image, quantity FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();

    if (!cartItems || cartItems.length === 0) {
      return c.json({ success: false, error: "Cart khali hai, checkout nahi ho sakta." }, 400);
    }

    const stripe = getStripe(c.env);

    const line_items = cartItems.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Number(item.quantity),
    }));

    line_items.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping' },
        unit_amount: 1000,
      },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: successUrl || `${c.env.FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${c.env.FRONTEND_URL}/cart`,
      metadata: { userId: String(userId) },
    });

    return c.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Error in /create-checkout-session:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Step 2: Stripe yahan payment success par call karta hai (server-to-server)
app.post('/webhook/stripe', async (c) => {
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  const stripe = getStripe(c.env);
  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return c.json({ error: `Webhook Error: ${err.message}` }, 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;

    if (userId) {
      const db = c.env.DB;
      const existing = await db.prepare(
        `SELECT id FROM orders WHERE stripe_session_id = ?`
      ).bind(session.id).first();

      if (!existing) {
        await createOrderFromCart(db, userId, 'card', session.id);
      }
    }
  }

  return c.json({ received: true });
});

// Step 3: Frontend ka success page is se poll karega ke order ban gaya ya nahi
app.get('/order/by-session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = c.env.DB;
  const order = await db.prepare(
    `SELECT * FROM orders WHERE stripe_session_id = ?`
  ).bind(sessionId).first();

  if (!order) return c.json({ success: false, error: "Order abhi confirm nahi hua." }, 404);
  return c.json({ success: true, order });
});

export default app;