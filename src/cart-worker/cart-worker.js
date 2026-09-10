import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS enable karein (DELETE method bhi shamil hai)
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.text('Cart Worker is live!'));

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

    // Database mein product insert ya quantity update karein
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

    // Agar quantity 0 ya negative ho gayi ho to us row ko clean up kar dein
    await db.prepare(`
      DELETE FROM cart WHERE user_id = ? AND product_id = ? AND quantity <= 0
    `).bind(String(userId), String(productId)).run();

    // Updated cart items fetch karein
    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image 
      FROM cart 
      WHERE user_id = ?
    `).bind(String(userId)).all();

    return c.json({
      success: true,
      message: "Cart successfully updated!",
      items: results || []
    });

  } catch (error) {
    console.error("Error in /cart/add:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. GET ALL CART ITEMS ROUTE
app.get('/cart', async (c) => {
  try {
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json({ success: false, error: "userId query parameter zaroori hai!" }, 400);
    }

    const db = c.env.DB;

    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image 
      FROM cart 
      WHERE user_id = ?
    `).bind(userId).all();

    return c.json({ success: true, items: results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. REMOVE ITEM ROUTE
app.delete('/cart/remove', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, productId } = body;

    if (!userId || !productId) {
      return c.json({ success: false, error: "userId aur productId zaroori hain!" }, 400);
    }

    const db = c.env.DB;
    await db.prepare(
      "DELETE FROM cart WHERE user_id = ? AND product_id = ?"
    ).bind(userId, productId).run();

    // Updated cart bhi return kar dein taake frontend cache sync rahe
    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image 
      FROM cart WHERE user_id = ?
    `).bind(userId).all();

    return c.json({ success: true, message: "Item cart se remove ho gaya!", items: results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 4. GET CART COUNT ROUTE
app.get('/cart/count', async (c) => {
  try {
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json({ success: false, error: "userId query parameter zaroori hai!" }, 400);
    }

    const db = c.env.DB;

    const result = await db.prepare(
      "SELECT SUM(quantity) as totalCount FROM cart WHERE user_id = ?"
    ).bind(userId).first();

    const totalCount = result?.totalCount || 0;

    return c.json({ success: true, count: totalCount });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 5. CHECKOUT ROUTE — cart -> order (D1 batch = atomic transaction)
app.post('/checkout', async (c) => {
  try {
    const { userId, shipping, paymentMethod } = await c.req.json();

    if (!userId) {
      return c.json({ success: false, error: "userId zaroori hai!" }, 400);
    }

    const db = c.env.DB;

    // Step 1: current cart items uthayein
    const { results: cartItems } = await db.prepare(`
      SELECT product_id, name, price, image, quantity
      FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();

    if (!cartItems || cartItems.length === 0) {
      return c.json({ success: false, error: "Cart khali hai, checkout nahi ho sakta." }, 400);
    }

    // Step 2: totals server-side calculate karein (client ke numbers par
    // bharosa nahi karte — price manipulation se bachne ke liye)
    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
    const shippingCost = subtotal > 0 ? 10.0 : 0;
    const total = subtotal + shippingCost;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Step 3: order header insert (last_row_id chahiye, isliye alag se .run())
    const orderInsert = await db.prepare(`
      INSERT INTO orders (order_number, user_id, subtotal, shipping, total, status, payment_method)
      VALUES (?, ?, ?, ?, ?, 'paid', ?)
    `).bind(orderNumber, String(userId), subtotal, shippingCost, total, paymentMethod || "").run();

    const orderId = orderInsert.meta.last_row_id;

    // Step 4: order_items inserts + cart delete — ek batch (atomic) mein
    const itemStatements = cartItems.map((item) =>
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, name, price, image, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.product_id,
        item.name,
        item.price,
        item.image,
        item.quantity,
        Number(item.price) * Number(item.quantity)
      )
    );

    const deleteCartStatement = db.prepare(
      `DELETE FROM cart WHERE user_id = ?`
    ).bind(String(userId));

    await db.batch([...itemStatements, deleteCartStatement]);

    return c.json({
      success: true,
      message: "Order successfully placed!",
      order: {
        id: orderId,
        orderNumber,
        subtotal,
        shipping: shippingCost,
        total,
        itemsCount: cartItems.length,
      },
    });
  } catch (error) {
    console.error("Error in /checkout:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;