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
app.post('/cart/add', async (c) => {
  try {
    const { userId, productId, quantity, name, price, image } = await c.req.json();

    if (!userId || !productId) {
      return c.json({ success: false, error: "UserId and ProductId are required!" }, 400);
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
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
// 2. GET ALL CART ITEMS ROUTE (Ab cart table se name, price aur image bhi fetch honge)
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

    return c.json({ success: true, message: "Item cart se remove ho gaya!" });
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

export default app;