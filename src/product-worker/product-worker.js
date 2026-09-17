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
        // product_count add kiya — sirf 'active' products count hote hain,
        // taake frontend dropdown mein har brand ke saamne count dikha sake.
        const { results } = await c.env.DB.prepare(
            `SELECT b.id, b.name, b.slug, b.logo,
                    (SELECT COUNT(*) FROM products WHERE brand_id = b.id AND status = 'active') as product_count
             FROM brands b ORDER BY b.name ASC`
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

        const category = c.req.query('category');
        const brand = c.req.query('brand');
        const filterCategory = c.req.query('filterCategory');
        const type = c.req.query('type');
        const collection = c.req.query('collection');

        const isNewIn = c.req.query('is_new_in');
        const featured = c.req.query('featured');
        const bestseller = c.req.query('bestseller');

        const search = (c.req.query('search') || '').trim();
        const sort = c.req.query('sort') || 'newest';
        const conditions = ["p.status = 'active'"];
        const bindings = [];

        if (category) { conditions.push('(cat.slug = ? OR cat.name = ?)'); bindings.push(category, category); }
        if (brand) { conditions.push('(b.slug = ? OR b.name = ?)'); bindings.push(brand, brand); }
        if (filterCategory) {
            conditions.push('p.filter_category = ?');
            bindings.push(filterCategory);
        }

        if (type) {
            conditions.push('p.type = ?');
            bindings.push(type);
        }

        if (search) {
            conditions.push('p.name LIKE ?');
            bindings.push(`%${search}%`);
        }

        // Home page ke independent database filters
        if (isNewIn === '1') {
            conditions.push('p.is_new_in = 1');
        }

        if (featured === '1') {
            conditions.push('p.featured = 1');
        }

        if (bestseller === '1') {
            conditions.push('p.bestseller = 1');
        }

        // Existing collection filters
        if (collection === 'new-in') {
            conditions.push('p.is_new_in = 1');
        } else if (collection === 'sale') {
            conditions.push('p.is_on_sale = 1');
        } else if (collection === 'featured') {
            conditions.push('p.featured = 1');
        } else if (collection === 'bestseller') {
            conditions.push('p.bestseller = 1');
        }
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

        // BUG FIX: brand_logo wasn't being selected here at all, so the
        // navbar search dropdown (and anywhere else using /products) had no
        // way to show a brand's logo next to its name — only brand_name text
        // was available. Added b.logo as brand_logo alongside the existing
        // brand_name/brand_slug columns.
        const { results } = await c.env.DB.prepare(
            `SELECT p.*, cat.name as category_name, cat.slug as category_slug,
                    b.name as brand_name, b.slug as brand_slug, b.logo as brand_logo
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
        // Same brand_logo addition here for consistency — the product
        // detail page benefits from the same field being available.
        const product = await c.env.DB.prepare(
            `SELECT p.*, cat.name as category_name, cat.slug as category_slug,
                    b.name as brand_name, b.slug as brand_slug, b.logo as brand_logo
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

        // FIX: body.logo agar undefined ho (field bheji hi nahi) to D1 ka
        // .bind() crash ho jata tha — D1 sirf null accept karta hai, undefined nahi.
        const logoValue = body.logo !== undefined ? body.logo : null;

        await c.env.DB.prepare(
            'UPDATE brands SET name = ?, slug = ?, logo = COALESCE(?, logo) WHERE id = ?'
        ).bind(body.name.trim(), slugify(body.name), logoValue, id).run();
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

        // FIX: same as public listing — bestseller ab boolean column p.bestseller = 1
        // se filter hota hai, badge text field se nahi.
        if (collection === 'new-in') conditions.push('p.is_new_in = 1');
        else if (collection === 'sale') conditions.push('p.is_on_sale = 1');
        else if (collection === 'featured') conditions.push('p.featured = 1');
        else if (collection === 'bestseller') conditions.push('p.bestseller = 1');

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
        console.log('Received body:', JSON.stringify(body));
        const { name, price, image, category_id } = body;

        if (!name || !price || !image || !category_id) {
            return c.json({ success: false, message: 'name, price, image aur category zaroori hain.' }, 400);
        }

        // FIX: bestseller column featured ki tarah insert honi chahiye (0/1),
        // warna admin panel se product ko bestseller mark karne ka koi tareeqa
        // nahi tha (sirf 'badge' text field set hota tha, jo alag cheez hai).
        const result = await c.env.DB.prepare(
            `INSERT INTO products
                (name, description, price, sale_price, image, category_id, brand_id, filter_category, type, badge, is_new_in, is_on_sale, featured, bestseller, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            body.bestseller ? 1 : 0,
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
        // FIX: 'bestseller' field add ki gayi hai taake PATCH se bhi
        // products ko bestseller mark/unmark kiya ja sake — 'featured' jaisa.
        const fields = ['name', 'description', 'price', 'sale_price', 'image', 'category_id', 'brand_id', 'filter_category', 'type', 'badge', 'is_new_in', 'is_on_sale', 'featured', 'bestseller', 'status'];
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

// ==========================================
// WISHLIST
// ==========================================

app.get('/wishlist', async (c) => {
    const userId = c.req.query('user_id');
    if (!userId) return c.json({ success: false, message: 'user_id zaroori hai.' }, 400);

    try {
        const { results } = await c.env.DB.prepare(
            `SELECT w.id as wishlist_id, w.created_at as added_at, w.deal_id, w.deal_name,
                    p.*, cat.name as category_name, b.name as brand_name,
                    d.value as deal_value, d.type as deal_type
             FROM wishlist_items w
             JOIN products p ON p.id = w.product_id
             LEFT JOIN categories cat ON cat.id = p.category_id
             LEFT JOIN brands b ON b.id = p.brand_id
             LEFT JOIN deals d ON d.id = w.deal_id
             WHERE w.user_id = ?
             ORDER BY w.created_at DESC`
        ).bind(userId).all();

        // Deal wale items ke liye discounted price + original_price compute karo,
        // kyunki wishlist_items table mein price store nahi hoti — hamesha
        // products ka current price hi source of truth hai.
        // deal_type: '%' = percentage discount, '$' = flat amount discount
        const wishlist = results.map((item) => {
            if (item.deal_id && item.deal_value != null) {
                const basePrice = Number(item.price);
                let discounted = basePrice;

                if (item.deal_type === '%') {
                    discounted = basePrice - (basePrice * Number(item.deal_value)) / 100;
                } else if (item.deal_type === '$') {
                    discounted = basePrice - Number(item.deal_value);
                }

                discounted = Math.max(0, Math.round(discounted * 100) / 100);

                return {
                    ...item,
                    original_price: basePrice,
                    sale_price: discounted,
                };
            }

            // FIX: normal (non-deal) sale items — CategoryPage se wishlist mein
            // aaye hue products bhi apni khud ki sale_price rakh sakte hain
            // (products.sale_price column). Pehle in ke liye original_price
            // kabhi set hi nahi hoti thi, isliye frontend pe strikethrough
            // kabhi nahi chalta tha. Ab agar sale_price maujood hai aur price
            // se alag hai, to original_price = price set kar dete hain.
            if (item.sale_price != null && Number(item.sale_price) !== Number(item.price)) {
                return {
                    ...item,
                    original_price: Number(item.price),
                };
            }

            return item;
        });

        return c.json({ success: true, wishlist });
    } catch (error) {
        return c.json({ success: false, message: `Failed to load wishlist: ${error.message}` }, 500);
    }
});

app.post('/wishlist', async (c) => {
    try {
        const { user_id, product_id, deal_id, deal_name } = await c.req.json();
        if (!user_id || !product_id) {
            return c.json({ success: false, message: 'user_id aur product_id zaroori hain.' }, 400);
        }

        // "" (not null) so it's a real, comparable value for the
        // UNIQUE(user_id, product_id, deal_id) constraint — NULL never
        // equals NULL in SQLite, which would break de-duping.
        const finalDealId = deal_id !== undefined && deal_id !== null && deal_id !== "" ? String(deal_id) : "";

        await c.env.DB.prepare(
            `INSERT INTO wishlist_items (user_id, product_id, deal_id, deal_name)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id, product_id, deal_id) DO NOTHING`
        ).bind(user_id, product_id, finalDealId, deal_name || null).run();

        return c.json({ success: true, message: 'Product wishlist mein add ho gaya.' });
    } catch (error) {
        return c.json({ success: false, message: `Failed to add to wishlist: ${error.message}` }, 500);
    }
});

app.delete('/wishlist/:productId', async (c) => {
    try {
        const productId = c.req.param('productId');
        const userId = c.req.query('user_id');
        const dealId = c.req.query('deal_id');
        if (!userId) return c.json({ success: false, message: 'user_id zaroori hai.' }, 400);

        if (dealId !== undefined) {
            // Caller knows exactly which line (deal or normal) to remove.
            const finalDealId = dealId !== "" ? String(dealId) : "";
            await c.env.DB.prepare(
                `DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ? AND deal_id = ?`
            ).bind(userId, productId, finalDealId).run();
        } else {
            // Backward-compat: no deal_id passed, remove every line for this product.
            await c.env.DB.prepare(
                `DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?`
            ).bind(userId, productId).run();
        }

        return c.json({ success: true, message: 'Product wishlist se remove ho gaya.' });
    } catch (error) {
        return c.json({ success: false, message: `Failed to remove from wishlist: ${error.message}` }, 500);
    }
});

export default app;