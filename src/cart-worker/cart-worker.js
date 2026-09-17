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
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// ---- LOYALTY HELPERS ----

async function getLoyaltySettings(db) {
  const settings = await db.prepare('SELECT * FROM loyalty_settings WHERE id = 1').first();
  return settings || {
    earn_rate: 10, redeem_rate: 100, min_redeem_points: 200, max_redeem_percent: 50, is_enabled: 1,
  };
}

// cart/orders sirf public_id (UUID) jaante hain — loyalty ka internal id + balance yahan se milta hai
async function getUserRowByPublicId(db, publicId) {
  return db.prepare('SELECT id, loyalty_points FROM users WHERE public_id = ?').bind(String(publicId)).first();
}

// ---- COUPON HELPERS ----

async function findCouponByCode(db, code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE').bind(String(code).trim()).first();
}

async function countUserCouponUsage(db, couponId, userId) {
  const row = await db.prepare(
    'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ? AND user_id = ?'
  ).bind(couponId, String(userId)).first();
  return row?.count || 0;
}

// Fixed-amount ya percentage discount, subtotal aur (agar set ho) max_discount_amount
// dono se clamp hota hai — kabhi bhi subtotal sa zyada discount nahi milta.
function computeCouponDiscount(coupon, subtotal) {
  let discount = coupon.type === '%'
    ? (subtotal * Number(coupon.value)) / 100
    : Number(coupon.value);

  if (coupon.max_discount_amount !== null && coupon.max_discount_amount !== undefined) {
    discount = Math.min(discount, Number(coupon.max_discount_amount));
  }
  discount = Math.min(discount, subtotal);
  return Math.max(0, Math.round(discount * 100) / 100);
}

// Saari PRD 3.4 validation rules is exact order mein: exists -> active ->
// date window -> min order -> total limit -> per-user limit.
async function validateCoupon(db, code, userId, subtotal) {
  const coupon = await findCouponByCode(db, code);
  if (!coupon) {
    return { valid: false, error: 'This coupon code does not exist.' };
  }
  if (coupon.status !== 'active') {
    return { valid: false, error: 'This coupon is currently inactive.' };
  }

  const now = new Date();
  if (coupon.starts_at && now < new Date(coupon.starts_at)) {
    return { valid: false, error: 'This coupon has not started yet.' };
  }
  if (coupon.expires_at && now > new Date(coupon.expires_at)) {
    return { valid: false, error: 'This coupon has expired.' };
  }

  if (Number(coupon.min_order_amount) > 0 && subtotal < Number(coupon.min_order_amount)) {
    return {
      valid: false,
      error: `A minimum order of $${Number(coupon.min_order_amount).toFixed(2)} is required for this coupon.`,
    };
  }

  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    return { valid: false, error: 'This coupon has reached its usage limit.' };
  }

  if (coupon.per_user_limit !== null && coupon.per_user_limit !== undefined) {
    const usedByUser = await countUserCouponUsage(db, coupon.id, userId);
    if (usedByUser >= Number(coupon.per_user_limit)) {
      return { valid: false, error: 'You have already reached the maximum usage limit for this coupon.' };
    }
  }

  const discount = computeCouponDiscount(coupon, subtotal);
  return { valid: true, coupon, discount };
}

// Cart -> Order conversion (shared helper, /webhook/stripe se call hota hai)
async function createOrderFromCart(db, userId, paymentMethod, stripeSessionId, redeemPoints = 0, couponCode = null) {
  const { results: cartItems } = await db.prepare(`
    SELECT c.product_id, c.name, c.price, c.image, c.quantity,
           c.deal_id, c.deal_name, c.original_price,
           d.type AS deal_type, d.value AS deal_value
    FROM cart c
    LEFT JOIN deals d ON d.id = CAST(NULLIF(c.deal_id, '') AS INTEGER)
    WHERE c.user_id = ?
  `).bind(String(userId)).all();

  if (!cartItems || cartItems.length === 0) return null;

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity), 0
  );
  const shippingCost = subtotal > 0 ? 10.0 : 0;

  // ---- Loyalty: redeem (agar requested) + earn on final paid amount ----
  const settings = await getLoyaltySettings(db);
  const userRow = await getUserRowByPublicId(db, userId);

  let loyaltyDiscount = 0;
  let actualRedeemed = 0;
  const currentBalance = userRow ? Number(userRow.loyalty_points) || 0 : 0;

  // ---- Coupon: authoritative re-validation, race-condition safe (jaisa loyalty ke sath hota hai) ----
  let appliedCoupon = null;
  let couponDiscount = 0;

  if (couponCode) {
    // Coupon aur points redeem mutually exclusive hain — coupon priority leta hai
    // yahan par (create-checkout-session mein already enforce ho chuka hoga).
    const result = await validateCoupon(db, couponCode, userId, subtotal);
    if (result.valid) {
      appliedCoupon = result.coupon;
      couponDiscount = result.discount;
    }
    // Agar webhook tak aate aate coupon invalid ho gaya (expire/limit khatam),
    // discount silently 0 rehta hai — order phir bhi place hota hai, taake
    // customer ka paisa Stripe pe already le liya gaya ho to order na atke.
  } else if (settings.is_enabled && userRow && Number(redeemPoints) > 0) {
    const requested = Math.min(Number(redeemPoints), currentBalance);
    const maxDiscount = (subtotal * Number(settings.max_redeem_percent)) / 100;
    let discount = requested / Number(settings.redeem_rate);
    discount = Math.min(discount, maxDiscount, subtotal);
    actualRedeemed = Math.floor(discount * Number(settings.redeem_rate));
    loyaltyDiscount = actualRedeemed / Number(settings.redeem_rate);
  }

  const discountAmount = loyaltyDiscount; // kept for backwards-compat column meaning: loyalty discount
  const total = Math.max(0, subtotal + shippingCost - discountAmount - couponDiscount);
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const pointsEarned = settings.is_enabled
    ? Math.floor(Math.max(0, subtotal - discountAmount - couponDiscount) * Number(settings.earn_rate))
    : 0;

  const orderInsert = await db.prepare(`
    INSERT INTO orders (order_number, user_id, subtotal, shipping, total, status, payment_method, stripe_session_id, discount_amount, points_redeemed, points_earned, coupon_code, coupon_discount)
    VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderNumber, String(userId), subtotal, shippingCost, total,
    paymentMethod || "card", stripeSessionId || null,
    discountAmount, actualRedeemed, pointsEarned,
    appliedCoupon ? appliedCoupon.code : null, couponDiscount
  ).run();

  const orderId = orderInsert.meta.last_row_id;

  const itemStatements = cartItems.map((item) =>
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, price, image, quantity, line_total, deal_id, deal_name, original_price, deal_type, deal_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, item.product_id, item.name, item.price, item.image, item.quantity,
      Number(item.price) * Number(item.quantity),
      item.deal_id || null, item.deal_name || null, item.original_price || null,
      item.deal_type || null, item.deal_value || null
    )
  );

  const deleteCartStatement = db.prepare(`DELETE FROM cart WHERE user_id = ?`).bind(String(userId));
  const batchStatements = [...itemStatements, deleteCartStatement];

  if (appliedCoupon && couponDiscount > 0) {
    batchStatements.push(
      db.prepare(`
        INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount)
        VALUES (?, ?, ?, ?)
      `).bind(appliedCoupon.id, String(userId), orderId, couponDiscount)
    );
    batchStatements.push(
      db.prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(appliedCoupon.id)
    );
  }

  if (userRow) {
    const netChange = pointsEarned - actualRedeemed;
    const newBalance = currentBalance + netChange;

    batchStatements.push(
      db.prepare('UPDATE users SET loyalty_points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(newBalance, userRow.id)
    );

    if (actualRedeemed > 0) {
      batchStatements.push(
        db.prepare(`
          INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, note)
          VALUES (?, ?, 'redeem', ?, ?, ?)
        `).bind(userRow.id, orderId, -actualRedeemed, currentBalance - actualRedeemed, `Redeemed at checkout — order ${orderNumber}`)
      );
    }
    if (pointsEarned > 0) {
      batchStatements.push(
        db.prepare(`
          INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, note)
          VALUES (?, ?, 'earn', ?, ?, ?)
        `).bind(userRow.id, orderId, pointsEarned, newBalance, `Earned from order ${orderNumber}`)
      );
    }
  }

  await db.batch(batchStatements);

  return {
    id: orderId, orderNumber, subtotal, shipping: shippingCost,
    discount: discountAmount, total, pointsEarned, pointsRedeemed: actualRedeemed,
    couponCode: appliedCoupon ? appliedCoupon.code : null, couponDiscount,
    itemsCount: cartItems.length,
  };
}

app.get('/', (c) => c.text('Cart Worker is live!'));

// ---- CART ROUTES (unchanged) ----

app.post('/cart/add', async (c) => {
  try {
    const { userId, productId, quantity, name, price, image, dealId, dealName, originalPrice } = await c.req.json();
    if (!userId || !productId) {
      return c.json({ success: false, error: "UserId and ProductId are required!" }, 400);
    }
    const qty = Number(quantity) !== 0 && Number.isFinite(Number(quantity)) ? Number(quantity) : 1;
    const productPrice = Number(price) || 0;
    const productImage = image || "";
    const finalDealId = dealId !== undefined && dealId !== null && dealId !== "" ? String(dealId) : "";
    const finalDealName = dealName ?? null;
    const finalOriginalPrice =
      originalPrice !== undefined && originalPrice !== null ? Number(originalPrice) : null;
    const db = c.env.DB;

    await db.prepare(`
      INSERT INTO cart (user_id, product_id, quantity, name, price, image, deal_id, deal_name, original_price) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, product_id, deal_id) 
      DO UPDATE SET 
        quantity = cart.quantity + excluded.quantity,
        name = excluded.name,
        price = excluded.price,
        image = excluded.image,
        deal_name = excluded.deal_name,
        original_price = excluded.original_price
    `).bind(
      String(userId), String(productId), qty, name || "", productPrice, productImage,
      finalDealId, finalDealName, finalOriginalPrice
    ).run();

    await db.prepare(`
      DELETE FROM cart WHERE user_id = ? AND product_id = ? AND deal_id = ? AND quantity <= 0
    `).bind(String(userId), String(productId), finalDealId).run();

    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image, deal_id, deal_name, original_price
      FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();

    return c.json({ success: true, message: "Cart successfully updated!", items: results || [] });
  } catch (error) {
    console.error("Error in /cart/add:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/cart', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ success: false, error: "The userId query parameter is required!" }, 400);
    const db = c.env.DB;
    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image, deal_id, deal_name, original_price
      FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();
    return c.json({ success: true, items: results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.delete('/cart/remove', async (c) => {
  try {
    const { userId, productId, dealId } = await c.req.json();
    if (!userId || !productId) {
      return c.json({ success: false, error: "userId and productId are required!" }, 400);
    }
    const db = c.env.DB;
    if (dealId !== undefined) {
      const finalDealId = dealId !== null && dealId !== "" ? String(dealId) : "";
      await db.prepare("DELETE FROM cart WHERE user_id = ? AND product_id = ? AND deal_id = ?")
        .bind(String(userId), String(productId), finalDealId)
        .run();
    } else {
      await db.prepare("DELETE FROM cart WHERE user_id = ? AND product_id = ?")
        .bind(String(userId), String(productId))
        .run();
    }
    const { results } = await db.prepare(`
      SELECT product_id, quantity, user_id, name, price, image, deal_id, deal_name, original_price
      FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();
    return c.json({ success: true, message: "Item has been removed from the cart!", items: results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/cart/count', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ success: false, error: "The userId query parameter is required!" }, 400);
    const db = c.env.DB;
    const result = await db.prepare(
      "SELECT SUM(quantity) as totalCount FROM cart WHERE user_id = ?"
    ).bind(String(userId)).first();
    return c.json({ success: true, count: result?.totalCount || 0 });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ---- LOYALTY: current balance + settings (checkout page ke liye) ----

app.get('/loyalty/balance', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ success: false, error: "The userId query parameter is required!" }, 400);
    const db = c.env.DB;

    const settings = await getLoyaltySettings(db);
    const userRow = await getUserRowByPublicId(db, userId);

    return c.json({
      success: true,
      points: userRow ? Number(userRow.loyalty_points) || 0 : 0,
      settings: {
        earn_rate: Number(settings.earn_rate),
        redeem_rate: Number(settings.redeem_rate),
        min_redeem_points: Number(settings.min_redeem_points),
        max_redeem_percent: Number(settings.max_redeem_percent),
        is_enabled: !!settings.is_enabled,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ---- COUPON: preview/validate for the "Apply" button on cart page ----

app.post('/coupon/validate', async (c) => {
  try {
    const { userId, code } = await c.req.json();
    if (!userId) return c.json({ success: false, error: "userId is required!" }, 400);
    if (!code || !String(code).trim()) return c.json({ success: false, error: "Please enter a coupon code." }, 400);

    const db = c.env.DB;
    const { results: cartItems } = await db.prepare(`
      SELECT price, quantity FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();

    const subtotal = (cartItems || []).reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity), 0
    );

    if (subtotal <= 0) {
      return c.json({ success: false, error: "Your cart is empty." }, 400);
    }

    const result = await validateCoupon(db, code, userId, subtotal);
    if (!result.valid) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({
      success: true,
      code: result.coupon.code,
      description: result.coupon.description || null,
      discount: result.discount,
    });
  } catch (error) {
    console.error("Error in /coupon/validate:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ---- STRIPE CHECKOUT ----

app.post('/create-checkout-session', async (c) => {
  try {
    const { userId, successUrl, cancelUrl, redeemPoints, couponCode } = await c.req.json();
    if (!userId) return c.json({ success: false, error: "userId is required!" }, 400);

    const db = c.env.DB;
    const { results: cartItems } = await db.prepare(`
      SELECT product_id, name, price, image, quantity FROM cart WHERE user_id = ?
    `).bind(String(userId)).all();

    if (!cartItems || cartItems.length === 0) {
      return c.json({ success: false, error: "Your cart is empty. Checkout cannot proceed." }, 400);
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity), 0
    );

    const requestedPoints = Number(redeemPoints) || 0;

    // Coupon aur loyalty points ek sath redeem nahi ho sakte.
    if (couponCode && requestedPoints > 0) {
      return c.json({ success: false, error: "You can use either a coupon or loyalty points, but not both at the same time." }, 400);
    }

    let discountAmount = 0;
    let actualRedeemed = 0;
    let validatedCouponCode = null;
    let couponDiscount = 0;

    if (couponCode) {
      const result = await validateCoupon(db, couponCode, userId, subtotal);
      if (!result.valid) {
        return c.json({ success: false, error: result.error }, 400);
      }
      validatedCouponCode = result.coupon.code;
      couponDiscount = result.discount;
    } else if (requestedPoints > 0) {
      // ---- Loyalty redemption validation (final calculation webhook par dobara hoti hai) ----
      const settings = await getLoyaltySettings(db);
      const userRow = await getUserRowByPublicId(db, userId);

      if (!settings.is_enabled) {
        return c.json({ success: false, error: "The loyalty program is currently disabled." }, 400);
      }
      const currentBalance = userRow ? Number(userRow.loyalty_points) || 0 : 0;
      if (requestedPoints > currentBalance) {
        return c.json({ success: false, error: "You do not have enough points." }, 400);
      }
      if (requestedPoints < Number(settings.min_redeem_points)) {
        return c.json({ success: false, error: `A minimum of ${settings.min_redeem_points} points is required to redeem.` }, 400);
      }
      const maxDiscount = (subtotal * Number(settings.max_redeem_percent)) / 100;
      discountAmount = Math.min(requestedPoints / Number(settings.redeem_rate), maxDiscount, subtotal);
      actualRedeemed = Math.floor(discountAmount * Number(settings.redeem_rate));
      discountAmount = actualRedeemed / Number(settings.redeem_rate);
    }

    const totalDiscount = discountAmount + couponDiscount;
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

    // Fixed-amount discount ek ad-hoc Stripe coupon se apply hota hai —
    // Checkout Session line items negative amount support nahi karte.
    let discounts;
    if (totalDiscount > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(totalDiscount * 100),
        currency: 'usd',
        duration: 'once',
        name: validatedCouponCode ? `Coupon: ${validatedCouponCode}` : 'Loyalty points redeemed',
      });
      discounts = [{ coupon: stripeCoupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      ...(discounts ? { discounts } : {}),
      success_url: successUrl || `${c.env.FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${c.env.FRONTEND_URL}/cart`,
      // redeemPoints/couponCode yahin metadata mein lock ho jate hain — webhook
      // inhi values ko use karega, session create k baad user inhe badal nahi sakta.
      metadata: {
        userId: String(userId),
        redeemPoints: String(actualRedeemed),
        couponCode: validatedCouponCode || '',
      },
    });

    return c.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      pointsRedeemed: actualRedeemed,
      discountAmount,
      couponCode: validatedCouponCode,
      couponDiscount,
    });
  } catch (error) {
    console.error("Error in /create-checkout-session:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

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
    const redeemPoints = Number(session.metadata?.redeemPoints) || 0;
    const couponCode = session.metadata?.couponCode || null;

    if (userId) {
      const db = c.env.DB;
      const existing = await db.prepare(
        `SELECT id FROM orders WHERE stripe_session_id = ?`
      ).bind(session.id).first();

      if (!existing) {
        await createOrderFromCart(db, userId, 'card', session.id, redeemPoints, couponCode);
      }
    }
  }

  return c.json({ received: true });
});

app.get('/order/by-session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = c.env.DB;
  const order = await db.prepare(
    `SELECT * FROM orders WHERE stripe_session_id = ?`
  ).bind(sessionId).first();

  if (!order) return c.json({ success: false, error: "Your order has not been confirmed yet." }, 404);
  return c.json({ success: true, order });
});

export default app;