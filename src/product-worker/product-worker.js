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

function slugify(str) {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

app.get('/', (c) => c.text('AURELIA Product API is running smoothly.'));

// ==========================================
// PUBLIC — CATEGORIES & BRANDS (menus/filters ke liye)
// ==========================================

app.get('/categories', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            'SELECT id, name, slug FROM categories ORDER BY name ASC'
        ).all();
        return c.json({ success: true, categories: results });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to load categories.' }, 500);
    }
});

app.get('/brands', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            'SELECT id, name, slug, logo FROM brands ORDER BY name ASC'
        ).all();
        return c.json({ success: true, brands: results });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to load brands.' }, 500);
    }
});

// ==========================================
// PUBLIC — PRODUCT LISTING (koi auth nahi)
// ==========================================

app.get('/products', async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '24', 10)));
        const offset = (page - 1) * limit;

        const category = c.req.query('category');   // name ya slug — 'Men', 'women', wagera
        const brand = c.req.query('brand');          // name ya slug
        const filterCategory = c.req.query('filterCategory');
        const type = c.req.query('type');
        const collection = c.req.query('collection');
        const search = (c.req.query('search') || '').trim();
        const sort = c.req.query('sort') || 'newest';

        const conditions = ["p.status = 'active'"];
        const bindings = [];

        if (category) { conditions.push('(cat.slug = ? OR cat.name = ?)'); bindings.push(category, category); }
        if (brand) { conditions.push('(b.slug = ? OR b.name = ?)'); bindings.push(brand, brand); }
        if (filterCategory) { conditions.push('p.filter_category = ?'); bindings.push(filterCategory); }
        if (type) { conditions.push('p.type = ?'); bindings.push(type); }
        if (search) { conditions.push('p.name LIKE ?'); bindings.push(`%${search}%`); }

        if (collection === 'new-in') conditions.push('p.is_new_in = 1');
        else if (collection === 'sale') conditions.push('p.is_on_sale = 1');
        else if (collection === 'featured') conditions.push('p.featured = 1');
        else if (collection === 'bestseller') conditions.push("p.badge = 'Bestseller'");

        const where = `WHERE ${conditions.join(' AND ')}`;

        const orderBy =
            sort === 'price_asc' ? 'p.price ASC' :
                sort === 'price_desc' ? 'p.price DESC' :
                    'p.created_at DESC';

        const joinClause = `
            FROM products p
            LEFT JOIN categories cat ON cat.id = p.category_id
            LEFT JOIN brands b ON b.id = p.brand_id
        `;

        const { results } = await c.env.DB.prepare(
            `SELECT p.*, cat.name as category_name, cat.slug as category_slug,
                    b.name as brand_name, b.slug as brand_slug
             ${joinClause}
             ${where}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count ${joinClause} ${where}`
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
            `SELECT p.*, cat.name as category_name, cat.slug as category_slug,
                    b.name as brand_name, b.slug as brand_slug
             FROM products p
             LEFT JOIN categories cat ON cat.id = p.category_id
             LEFT JOIN brands b ON b.id = p.brand_id
             WHERE p.id = ? AND p.status = 'active'`
        ).bind(id).first();

        if (!product) return c.json({ success: false, message: 'Product not found.' }, 404);
        return c.json({ success: true, product });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to load product.' }, 500);
    }
});

// ==========================================
// ADMIN — CATEGORIES CRUD
// ==========================================

app.get('/admin/categories', requireAdmin, async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT cat.*, (SELECT COUNT(*) FROM products WHERE category_id = cat.id) as product_count
             FROM categories cat ORDER BY cat.name ASC`
        ).all();
        return c.json({ success: true, categories: results });
    } catch (error) {
        return c.json({ success: false, message: `Failed to load categories: ${error.message}` }, 500);
    }
});

app.post('/admin/categories', requireAdmin, async (c) => {
    try {
        const { name } = await c.req.json();
        if (!name || !name.trim()) {
            return c.json({ success: false, message: 'Category name zaroori hai.' }, 400);
        }
        const result = await c.env.DB.prepare(
            'INSERT INTO categories (name, slug) VALUES (?, ?)'
        ).bind(name.trim(), slugify(name)).run();
        return c.json({ success: true, message: 'Category added.', id: result.meta.last_row_id });
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
            return c.json({ success: false, message: 'Yeh category pehle se maujood hai.' }, 400);
        }
        return c.json({ success: false, message: `Failed to add category: ${error.message}` }, 500);
    }
});

app.patch('/admin/categories/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const { name } = await c.req.json();
        if (!name || !name.trim()) {
            return c.json({ success: false, message: 'Category name zaroori hai.' }, 400);
        }
        await c.env.DB.prepare(
            'UPDATE categories SET name = ?, slug = ? WHERE id = ?'
        ).bind(name.trim(), slugify(name), id).run();
        return c.json({ success: true, message: 'Category updated.' });
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
            return c.json({ success: false, message: 'Yeh category naam pehle se maujood hai.' }, 400);
        }
        return c.json({ success: false, message: `Failed to update category: ${error.message}` }, 500);
    }
});

app.delete('/admin/categories/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const usage = await c.env.DB.prepare(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?'
        ).bind(id).first();
        if (usage?.count > 0) {
            return c.json({
                success: false,
                message: `Yeh category ${usage.count} product(s) mein use ho rahi hai. Pehle unki category badlein.`,
            }, 400);
        }
        await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: 'Category deleted.' });
    } catch (error) {
        return c.json({ success: false, message: `Failed to delete category: ${error.message}` }, 500);
    }
});

// ==========================================
// ADMIN — BRANDS CRUD
// ==========================================

app.get('/admin/brands', requireAdmin, async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT b.*, (SELECT COUNT(*) FROM products WHERE brand_id = b.id) as product_count
             FROM brands b ORDER BY b.name ASC`
        ).all();
        return c.json({ success: true, brands: results });
    } catch (error) {
        return c.json({ success: false, message: `Failed to load brands: ${error.message}` }, 500);
    }
});

app.post('/admin/brands', requireAdmin, async (c) => {
    try {
        const { name, logo } = await c.req.json();
        if (!name || !name.trim()) {
            return c.json({ success: false, message: 'Brand name zaroori hai.' }, 400);
        }
        const result = await c.env.DB.prepare(
            'INSERT INTO brands (name, slug, logo) VALUES (?, ?, ?)'
        ).bind(name.trim(), slugify(name), logo || null).run();
        return c.json({ success: true, message: 'Brand added.', id: result.meta.last_row_id });
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
            return c.json({ success: false, message: 'Yeh brand pehle se maujood hai.' }, 400);
        }
        return c.json({ success: false, message: `Failed to add brand: ${error.message}` }, 500);
    }
});

app.patch('/admin/brands/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        if (!body.name || !body.name.trim()) {
            return c.json({ success: false, message: 'Brand name zaroori hai.' }, 400);
        }
        await c.env.DB.prepare(
            'UPDATE brands SET name = ?, slug = ?, logo = COALESCE(?, logo) WHERE id = ?'
        ).bind(body.name.trim(), slugify(body.name), body.logo, id).run();
        return c.json({ success: true, message: 'Brand updated.' });
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
            return c.json({ success: false, message: 'Yeh brand naam pehle se maujood hai.' }, 400);
        }
        return c.json({ success: false, message: `Failed to update brand: ${error.message}` }, 500);
    }
});

app.delete('/admin/brands/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const usage = await c.env.DB.prepare(
            'SELECT COUNT(*) as count FROM products WHERE brand_id = ?'
        ).bind(id).first();
        if (usage?.count > 0) {
            return c.json({
                success: false,
                message: `Yeh brand ${usage.count} product(s) mein use ho rahi hai. Pehle unki brand badlein.`,
            }, 400);
        }
        await c.env.DB.prepare('DELETE FROM brands WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: 'Brand deleted.' });
    } catch (error) {
        return c.json({ success: false, message: `Failed to delete brand: ${error.message}` }, 500);
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
        const categoryId = c.req.query('category_id');
        const brandId = c.req.query('brand_id');
        const filterCategory = c.req.query('filterCategory');
        const collection = c.req.query('collection');
        const status = c.req.query('status');

        const conditions = [];
        const bindings = [];

        if (search) { conditions.push('p.name LIKE ?'); bindings.push(`%${search}%`); }
        if (categoryId) { conditions.push('p.category_id = ?'); bindings.push(categoryId); }
        if (brandId) { conditions.push('p.brand_id = ?'); bindings.push(brandId); }
        if (filterCategory) { conditions.push('p.filter_category = ?'); bindings.push(filterCategory); }
        if (status) { conditions.push('p.status = ?'); bindings.push(status); }

        if (collection === 'new-in') conditions.push('p.is_new_in = 1');
        else if (collection === 'sale') conditions.push('p.is_on_sale = 1');
        else if (collection === 'featured') conditions.push('p.featured = 1');
        else if (collection === 'bestseller') conditions.push("p.badge = 'Bestseller'");

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const joinClause = `
            FROM products p
            LEFT JOIN categories cat ON cat.id = p.category_id
            LEFT JOIN brands b ON b.id = p.brand_id
        `;

        const { results } = await c.env.DB.prepare(
            `SELECT p.*, cat.name as category_name, b.name as brand_name
             ${joinClause}
             ${where}
             ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count ${joinClause} ${where}`
        ).bind(...bindings).first();

        return c.json({ success: true, products: results, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin products list error:', error);
        return c.json({ success: false, message: `Failed to load products: ${error.message}` }, 500);
    }
});

app.post('/admin/products', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const { name, price, image, category_id } = body;

        if (!name || !price || !image || !category_id) {
            return c.json({ success: false, message: 'name, price, image aur category zaroori hain.' }, 400);
        }

        const result = await c.env.DB.prepare(
            `INSERT INTO products
                (name, description, price, sale_price, image, category_id, brand_id, filter_category, type, badge, is_new_in, is_on_sale, featured, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            name,
            body.description ? body.description.trim() : null,
            Number(price),
            body.sale_price ? Number(body.sale_price) : null,
            image,
            Number(category_id),
            body.brand_id ? Number(body.brand_id) : null,
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
        const fields = ['name', 'description', 'price', 'sale_price', 'image', 'category_id', 'brand_id', 'filter_category', 'type', 'badge', 'is_new_in', 'is_on_sale', 'featured', 'status'];
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