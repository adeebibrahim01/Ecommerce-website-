import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => origin || '*',
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    return corsMiddleware(c, next);
});

// ==========================================
// ADMIN TOKEN VERIFICATION
// admin-worker jaisa hi ADMIN_JWT_SECRET use karta hai, taake
// admin-worker se mila token yahan bhi valid ho.
// ==========================================

function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64Url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

async function hmacSign(data, secret) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return bufToBase64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyAdminToken(token, secret) {
    if (!token || !token.includes('.')) return null;
    const [encodedPayload, signature] = token.split('.');
    const expectedSig = await hmacSign(encodedPayload, secret);
    if (expectedSig !== signature) return null;

    try {
        const payload = JSON.parse(fromBase64Url(encodedPayload));
        if (!payload.uid || Date.now() > payload.exp) return null;
        return payload.uid;
    } catch {
        return null;
    }
}

const getAdminIdFromAuth = async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return null;
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!c.env.ADMIN_JWT_SECRET) {
        console.error('ADMIN_JWT_SECRET is not set for this worker.');
        return null;
    }
    return verifyAdminToken(token, c.env.ADMIN_JWT_SECRET);
};

async function requireAdmin(c, next) {
    const userId = await getAdminIdFromAuth(c);
    if (!userId) {
        return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    if (!c.env.DB) {
        return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    let user;
    try {
        user = await c.env.DB.prepare('SELECT id, role, status FROM users WHERE id = ?')
            .bind(userId)
            .first();
    } catch (error) {
        // Most common cause: this worker's DB binding points to a D1 database
        // that does not have a `users` table (e.g. a products-only database).
        console.error('requireAdmin user lookup failed:', error);
        return c.json({ success: false, message: `Admin check failed: ${error.message}` }, 500);
    }

    if (!user || user.status !== 'active') {
        return c.json({ success: false, message: 'Account not found or inactive.' }, 403);
    }
    if (user.role !== 'admin') {
        return c.json({ success: false, message: 'Forbidden: admin access required.' }, 403);
    }

    c.set('adminUserId', user.id);
    await next();
}

app.get('/', (c) => c.text('AURELIA Product API is running smoothly.'));

// ==========================================
// PUBLIC — PRODUCT LISTING (koi auth nahi)
// ==========================================

app.get('/products', async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '24', 10)));
        const offset = (page - 1) * limit;

        const category = c.req.query('category');
        const filterCategory = c.req.query('filterCategory');
        const type = c.req.query('type');
        const collection = c.req.query('collection');
        const search = (c.req.query('search') || '').trim();
        const sort = c.req.query('sort') || 'newest';

        const conditions = ["status = 'active'"];
        const bindings = [];

        if (category) { conditions.push('category = ?'); bindings.push(category); }
        if (filterCategory) { conditions.push('filter_category = ?'); bindings.push(filterCategory); }
        if (type) { conditions.push('type = ?'); bindings.push(type); }
        if (search) { conditions.push('name LIKE ?'); bindings.push(`%${search}%`); }

        if (collection === 'new-in') conditions.push('is_new_in = 1');
        else if (collection === 'sale') conditions.push('is_on_sale = 1');
        else if (collection === 'featured') conditions.push('featured = 1');
        else if (collection === 'bestseller') conditions.push("badge = 'Bestseller'");

        const where = `WHERE ${conditions.join(' AND ')}`;

        const orderBy =
            sort === 'price_asc' ? 'price ASC' :
                sort === 'price_desc' ? 'price DESC' :
                    'created_at DESC';

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM products ${where}`
        ).bind(...bindings).first();

        return c.json({ success: true, products: results, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Products list error:', error);
        return c.json({ success: false, message: 'Failed to load products.' }, 500);
    }
});

app.get('/products/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const product = await c.env.DB.prepare(
            `SELECT * FROM products WHERE id = ? AND status = 'active'`
        ).bind(id).first();

        if (!product) return c.json({ success: false, message: 'Product not found.' }, 404);
        return c.json({ success: true, product });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to load product.' }, 500);
    }
});

// ==========================================
// ADMIN — PRODUCTS (requireAdmin ke sath guarded)
// ==========================================
app.get('/admin/products', requireAdmin, async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        const search = (c.req.query('search') || '').trim();
        const category = c.req.query('category');
        const filterCategory = c.req.query('filterCategory');
        const collection = c.req.query('collection');
        const status = c.req.query('status');

        const conditions = [];
        const bindings = [];

        if (search) { conditions.push('name LIKE ?'); bindings.push(`%${search}%`); }
        if (category) { conditions.push('category = ?'); bindings.push(category); }
        if (filterCategory) { conditions.push('filter_category = ?'); bindings.push(filterCategory); }
        if (status) { conditions.push('status = ?'); bindings.push(status); }

        if (collection === 'new-in') conditions.push('is_new_in = 1');
        else if (collection === 'sale') conditions.push('is_on_sale = 1');
        else if (collection === 'featured') conditions.push('featured = 1');
        else if (collection === 'bestseller') conditions.push("badge = 'Bestseller'");

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM products ${where}`)
            .bind(...bindings)
            .first();

        return c.json({ success: true, products: results, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin products list error:', error);
        return c.json({ success: false, message: `Failed to load products: ${error.message}` }, 500);
    }
});

app.post('/admin/products', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const { name, price, image, category } = body;

        if (!name || !price || !image || !category) {
            return c.json({ success: false, message: 'name, price, image aur category zaroori hain.' }, 400);
        }

        const result = await c.env.DB.prepare(
            `INSERT INTO products
        (name, price, sale_price, image, category, filter_category, type, badge, is_new_in, is_on_sale, featured, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            name,
            Number(price),
            body.sale_price ? Number(body.sale_price) : null,
            image,
            category,
            body.filter_category || null,
            body.type || null,
            body.badge || '',
            body.is_new_in ? 1 : 0,
            body.is_on_sale ? 1 : 0,
            body.featured ? 1 : 0,
            body.status || 'active'
        ).run();

        return c.json({ success: true, message: 'Product added.', id: result.meta.last_row_id });
    } catch (error) {
        console.error('Admin product create error:', error);
        return c.json({ success: false, message: `Failed to add product: ${error.message}` }, 500);
    }
});

app.patch('/admin/products/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const fields = ['name', 'price', 'sale_price', 'image', 'category', 'filter_category', 'type', 'badge', 'is_new_in', 'is_on_sale', 'featured', 'status'];
        const updates = [];
        const bindings = [];

        for (const field of fields) {
            if (field in body) {
                updates.push(`${field} = ?`);
                bindings.push(body[field]);
            }
        }

        if (updates.length === 0) {
            return c.json({ success: false, message: 'Koi field update ke liye nahi di.' }, 400);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        bindings.push(id);

        await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...bindings)
            .run();

        return c.json({ success: true, message: 'Product updated.' });
    } catch (error) {
        console.error('Admin product update error:', error);
        return c.json({ success: false, message: `Failed to update product: ${error.message}` }, 500);
    }
});

app.delete('/admin/products/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: 'Product deleted.' });
    } catch (error) {
        console.error('Admin product delete error:', error);
        return c.json({ success: false, message: `Failed to delete product: ${error.message}` }, 500);
    }
});

export default app;