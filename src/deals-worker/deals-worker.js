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
// (Same HMAC scheme as the Product worker — tokens are minted by the
// User/Auth worker and just verified here against the shared secret.)
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

// ==========================================
// HELPERS
// ==========================================

const MAX_MULTISELECT_RESULTS = 5;

// Computes a human-readable label + final price preview for a deal.
// value=5, type='%'  -> "5% OFF"
// value=5, type='$'  -> "$5 OFF"
function dealLabel(value, type) {
    return type === '%' ? `${value}% OFF` : `$${value} OFF`;
}

// FIX: discounted price nikalne ka shared helper — wishlist worker mein
// jo formula tha wahi yahan bhi use karte hain, taake deal ka discount
// har jagah consistently calculate ho (rounding included).
function computeDiscountedPrice(basePrice, value, type) {
    let discounted = basePrice;
    if (type === '%') {
        discounted = basePrice - (basePrice * Number(value)) / 100;
    } else if (type === '$') {
        discounted = basePrice - Number(value);
    }
    return Math.max(0, Math.round(discounted * 100) / 100);
}

async function attachDealItems(db, dealId, applyTo, dealValue, dealType) {
    if (applyTo === 'product') {
        const { results } = await db.prepare(
            `SELECT p.id, p.name, p.image, p.price
             FROM deal_products dp
             JOIN products p ON p.id = dp.product_id
             WHERE dp.deal_id = ?
             ORDER BY p.name ASC`
        ).bind(dealId).all();

        // FIX: pehle sirf raw p.price return hoti thi, koi discounted amount
        // nahi bhejta tha — is liye deals ke andar wale products pe
        // frontend (Deals page / Product Detail Page) ko sale_price ya
        // original_price kabhi nahi milti thi aur strikethrough kabhi
        // dikhta hi nahi tha. Ab har product ke sath discount apply karke
        // sale_price/original_price bhi bhej rahe hain.
        return results.map((p) => {
            const basePrice = Number(p.price);
            const discounted = computeDiscountedPrice(basePrice, dealValue, dealType);
            return {
                ...p,
                original_price: basePrice,
                sale_price: discounted,
            };
        });
    }
    if (applyTo === 'category') {
        const { results } = await db.prepare(
            `SELECT c.id, c.name, c.slug
             FROM deal_categories dc
             JOIN categories c ON c.id = dc.category_id
             WHERE dc.deal_id = ?
             ORDER BY c.name ASC`
        ).bind(dealId).all();
        return results;
    }
    if (applyTo === 'brand') {
        const { results } = await db.prepare(
            `SELECT b.id, b.name, b.slug, b.logo
             FROM deal_brands db_
             JOIN brands b ON b.id = db_.brand_id
             WHERE db_.deal_id = ?
             ORDER BY b.name ASC`
        ).bind(dealId).all();
        return results;
    }
    return [];
}

async function replaceDealItems(db, dealId, applyTo, ids) {
    const uniqueIds = [...new Set((ids || []).map((v) => Number(v)).filter((v) => Number.isInteger(v)))];

    if (applyTo === 'product') {
        await db.prepare('DELETE FROM deal_products WHERE deal_id = ?').bind(dealId).run();
        for (const productId of uniqueIds) {
            await db.prepare('INSERT OR IGNORE INTO deal_products (deal_id, product_id) VALUES (?, ?)')
                .bind(dealId, productId).run();
        }
    } else if (applyTo === 'category') {
        await db.prepare('DELETE FROM deal_categories WHERE deal_id = ?').bind(dealId).run();
        for (const categoryId of uniqueIds) {
            await db.prepare('INSERT OR IGNORE INTO deal_categories (deal_id, category_id) VALUES (?, ?)')
                .bind(dealId, categoryId).run();
        }
    } else if (applyTo === 'brand') {
        await db.prepare('DELETE FROM deal_brands WHERE deal_id = ?').bind(dealId).run();
        for (const brandId of uniqueIds) {
            await db.prepare('INSERT OR IGNORE INTO deal_brands (deal_id, brand_id) VALUES (?, ?)')
                .bind(dealId, brandId).run();
        }
    }
}

app.get('/', (c) => c.text('AURELIA Deals API is running smoothly.'));

// ==========================================
// PUBLIC — ACTIVE DEALS (storefront ke liye)
// ==========================================

// GET /deals -> saare active deals, with attached items
app.get('/deals', async (c) => {
    try {
        const { results: deals } = await c.env.DB.prepare(
            `SELECT * FROM deals WHERE status = 'active' ORDER BY created_at DESC`
        ).all();

        const enriched = await Promise.all(
            deals.map(async (deal) => ({
                ...deal,
                label: dealLabel(deal.value, deal.type),
                items: await attachDealItems(c.env.DB, deal.id, deal.apply_to, deal.value, deal.type),
            }))
        );

        return c.json({ success: true, deals: enriched });
    } catch (error) {
        console.error('Public deals list error:', error);
        return c.json({ success: false, message: `Failed to load deals: ${error.message}` }, 500);
    }
});

// GET /deals/product/:productId -> is product par lagne wale active deals
// (direct product deal + uski category ka deal + uski brand ka deal)
app.get('/deals/product/:productId', async (c) => {
    try {
        const productId = c.req.param('productId');

        const product = await c.env.DB.prepare(
            'SELECT id, category_id, brand_id FROM products WHERE id = ?'
        ).bind(productId).first();

        if (!product) {
            return c.json({ success: false, message: 'Product not found.' }, 404);
        }

        const { results: deals } = await c.env.DB.prepare(
            `SELECT DISTINCT d.*
             FROM deals d
             LEFT JOIN deal_products dp ON dp.deal_id = d.id AND d.apply_to = 'product'
             LEFT JOIN deal_categories dc ON dc.deal_id = d.id AND d.apply_to = 'category'
             LEFT JOIN deal_brands db_ ON db_.deal_id = d.id AND d.apply_to = 'brand'
             WHERE d.status = 'active'
               AND (
                 (d.apply_to = 'product' AND dp.product_id = ?)
                 OR (d.apply_to = 'category' AND dc.category_id = ?)
                 OR (d.apply_to = 'brand' AND db_.brand_id = ?)
               )
             ORDER BY d.value DESC`
        ).bind(productId, product.category_id, product.brand_id).all();

        const enriched = deals.map((deal) => ({ ...deal, label: dealLabel(deal.value, deal.type) }));

        return c.json({ success: true, deals: enriched });
    } catch (error) {
        console.error('Product deals lookup error:', error);
        return c.json({ success: false, message: `Failed to load deals: ${error.message}` }, 500);
    }
});

// ==========================================
// ADMIN — MULTISELECT SEARCH HELPERS
// (Product/Category/Brand dropdowns yahan se API-fetch hote hain,
// max 5 results ek waqt, search query ke sath.)
// ==========================================

app.get('/admin/deals/search/products', requireAdmin, async (c) => {
    try {
        const search = (c.req.query('search') || '').trim();
        const where = search ? 'WHERE name LIKE ? AND status = ?' : 'WHERE status = ?';
        const bindings = search ? [`%${search}%`, 'active'] : ['active'];

        const { results } = await c.env.DB.prepare(
            `SELECT id, name, image, price FROM products ${where} ORDER BY name ASC LIMIT ?`
        ).bind(...bindings, MAX_MULTISELECT_RESULTS).all();

        return c.json({ success: true, products: results });
    } catch (error) {
        return c.json({ success: false, message: `Failed to search products: ${error.message}` }, 500);
    }
});

app.get('/admin/deals/search/categories', requireAdmin, async (c) => {
    try {
        const search = (c.req.query('search') || '').trim();
        const where = search ? 'WHERE name LIKE ?' : '';
        const bindings = search ? [`%${search}%`] : [];

        const { results } = await c.env.DB.prepare(
            `SELECT id, name, slug FROM categories ${where} ORDER BY name ASC LIMIT ?`
        ).bind(...bindings, MAX_MULTISELECT_RESULTS).all();

        return c.json({ success: true, categories: results });
    } catch (error) {
        return c.json({ success: false, message: `Failed to search categories: ${error.message}` }, 500);
    }
});

app.get('/admin/deals/search/brands', requireAdmin, async (c) => {
    try {
        const search = (c.req.query('search') || '').trim();
        const where = search ? 'WHERE name LIKE ?' : '';
        const bindings = search ? [`%${search}%`] : [];

        const { results } = await c.env.DB.prepare(
            `SELECT id, name, slug, logo FROM brands ${where} ORDER BY name ASC LIMIT ?`
        ).bind(...bindings, MAX_MULTISELECT_RESULTS).all();

        return c.json({ success: true, brands: results });
    } catch (error) {
        return c.json({ success: false, message: `Failed to search brands: ${error.message}` }, 500);
    }
});

// ==========================================
// ADMIN — DEALS CRUD (requireAdmin guarded)
// ==========================================

app.get('/admin/deals', requireAdmin, async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        const search = (c.req.query('search') || '').trim();
        const applyTo = c.req.query('apply_to');
        const status = c.req.query('status');

        const conditions = [];
        const bindings = [];

        if (search) { conditions.push('name LIKE ?'); bindings.push(`%${search}%`); }
        if (applyTo) { conditions.push('apply_to = ?'); bindings.push(applyTo); }
        if (status) { conditions.push('status = ?'); bindings.push(status); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM deals ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM deals ${where}`
        ).bind(...bindings).first();

        const enriched = await Promise.all(
            results.map(async (deal) => ({
                ...deal,
                label: dealLabel(deal.value, deal.type),
                items: await attachDealItems(c.env.DB, deal.id, deal.apply_to, deal.value, deal.type),
            }))
        );

        return c.json({ success: true, deals: enriched, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin deals list error:', error);
        return c.json({ success: false, message: `Failed to load deals: ${error.message}` }, 500);
    }
});

app.get('/admin/deals/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const deal = await c.env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();

        if (!deal) {
            return c.json({ success: false, message: 'Deal not found.' }, 404);
        }

        const items = await attachDealItems(c.env.DB, deal.id, deal.apply_to, deal.value, deal.type);

        return c.json({ success: true, deal: { ...deal, label: dealLabel(deal.value, deal.type), items } });
    } catch (error) {
        return c.json({ success: false, message: `Failed to load deal: ${error.message}` }, 500);
    }
});

app.post('/admin/deals', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const { name, value, type, apply_to, image } = body;

        if (!name || !name.trim()) {
            return c.json({ success: false, message: 'Deal name zaroori hai.' }, 400);
        }
        if (value === undefined || value === null || isNaN(Number(value))) {
            return c.json({ success: false, message: 'Deal value zaroori hai aur number honi chahiye.' }, 400);
        }
        if (!['%', '$'].includes(type)) {
            return c.json({ success: false, message: "Deal type '%' ya '$' hona chahiye." }, 400);
        }
        if (!['product', 'category', 'brand'].includes(apply_to)) {
            return c.json({ success: false, message: "apply_to 'product', 'category' ya 'brand' hona chahiye." }, 400);
        }

        const itemIds =
            apply_to === 'product' ? body.product_ids :
                apply_to === 'category' ? body.category_ids :
                    body.brand_ids;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return c.json({ success: false, message: `Kam az kam ek ${apply_to} select karna zaroori hai.` }, 400);
        }

        const result = await c.env.DB.prepare(
            `INSERT INTO deals (name, image, value, type, apply_to, status)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            name.trim(),
            image || null,
            Number(value),
            type,
            apply_to,
            body.status || 'active'
        ).run();

        const dealId = result.meta.last_row_id;
        await replaceDealItems(c.env.DB, dealId, apply_to, itemIds);

        return c.json({ success: true, message: 'Deal created.', id: dealId });
    } catch (error) {
        console.error('Admin deal create error:', error);
        return c.json({ success: false, message: `Failed to create deal: ${error.message}` }, 500);
    }
});

app.patch('/admin/deals/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const existing = await c.env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
        if (!existing) {
            return c.json({ success: false, message: 'Deal not found.' }, 404);
        }

        const fields = ['name', 'image', 'value', 'type', 'apply_to', 'status'];
        const updates = [];
        const bindings = [];

        for (const field of fields) {
            if (field in body) {
                updates.push(`${field} = ?`);
                bindings.push(body[field]);
            }
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            bindings.push(id);
            await c.env.DB.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`)
                .bind(...bindings)
                .run();
        }

        // Agar apply_to badla ya naye item_ids diye gaye, to attachments refresh karo
        const finalApplyTo = body.apply_to || existing.apply_to;
        const itemIds =
            finalApplyTo === 'product' ? body.product_ids :
                finalApplyTo === 'category' ? body.category_ids :
                    body.brand_ids;

        if (Array.isArray(itemIds)) {
            // apply_to switch hua ho to purani junction tables clear karo
            if (body.apply_to && body.apply_to !== existing.apply_to) {
                await c.env.DB.prepare('DELETE FROM deal_products WHERE deal_id = ?').bind(id).run();
                await c.env.DB.prepare('DELETE FROM deal_categories WHERE deal_id = ?').bind(id).run();
                await c.env.DB.prepare('DELETE FROM deal_brands WHERE deal_id = ?').bind(id).run();
            }
            await replaceDealItems(c.env.DB, id, finalApplyTo, itemIds);
        }

        return c.json({ success: true, message: 'Deal updated.' });
    } catch (error) {
        console.error('Admin deal update error:', error);
        return c.json({ success: false, message: `Failed to update deal: ${error.message}` }, 500);
    }
});
// GET /deals/:id -> single active deal + resolved items (public, storefront ke liye)
app.get('/deals/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const deal = await c.env.DB.prepare(
            `SELECT * FROM deals WHERE id = ? AND status = 'active'`
        ).bind(id).first();

        if (!deal) {
            return c.json({ success: false, message: 'Deal not found or inactive.' }, 404);
        }

        const items = await attachDealItems(c.env.DB, deal.id, deal.apply_to, deal.value, deal.type);

        return c.json({
            success: true,
            deal: { ...deal, label: dealLabel(deal.value, deal.type), items },
        });
    } catch (error) {
        console.error('Public deal detail error:', error);
        return c.json({ success: false, message: `Failed to load deal: ${error.message}` }, 500);
    }
});

app.delete('/admin/deals/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        // deal_products / deal_categories / deal_brands ON DELETE CASCADE se
        // apne aap clean ho jayenge (schema.sql dekhein).
        await c.env.DB.prepare('DELETE FROM deals WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: 'Deal deleted.' });
    } catch (error) {
        console.error('Admin deal delete error:', error);
        return c.json({ success: false, message: `Failed to delete deal: ${error.message}` }, 500);
    }
});

export default app;