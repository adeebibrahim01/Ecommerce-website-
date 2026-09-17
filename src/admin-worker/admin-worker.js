import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => origin || '*',
        allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    return corsMiddleware(c, next);
});

// ==========================================
// PASSWORD HASHING (PBKDF2 via Web Crypto)
// Same scheme jo customer worker use karta hai, kyunki admins bhi
// usi `users` table mein password hash ke sath store hote hain.
// ==========================================

function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
    return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
}

async function verifyPassword(password, stored) {
    if (!stored) return false;
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

    const iterations = parseInt(parts[1], 10);
    const salt = base64ToBuf(parts[2]);
    const expectedHash = parts[3];

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    const actualHash = bufToBase64(derivedBits);

    if (actualHash.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < actualHash.length; i++) {
        diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    return diff === 0;
}

// ==========================================
// ADMIN SESSION TOKENS (HMAC-signed, stateless)
// Apna alag secret (ADMIN_JWT_SECRET) — customer token se koi
// mel nahi, isliye customer session admin routes nahi khol sakta.
// ==========================================

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours — admin session customer se chota rakha

function toBase64Url(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

async function createAdminToken(userId, secret) {
    const payload = JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_SECONDS * 1000 });
    const encodedPayload = toBase64Url(payload);
    const signature = await hmacSign(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
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
    return verifyAdminToken(token, c.env.ADMIN_JWT_SECRET);
};

const safeAdmin = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    role: user.role,
});

// ==========================================
// ADMIN GUARD
// Har request par role dobara DB se verify hota hai — token khud
// par kabhi bharosa nahi karte.
// ==========================================

async function requireAdmin(c, next) {
    const userId = await getAdminIdFromAuth(c);
    if (!userId) {
        return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    if (!c.env.DB) {
        return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    const user = await c.env.DB.prepare('SELECT id, role, status FROM users WHERE id = ?')
        .bind(userId)
        .first();

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
// DEAL LABEL HELPERS
// Order items ke sath ready-made "70% OFF" / "$10 OFF" badge label
// bhejne ke liye. deal_type/deal_value checkout ke waqt order_items
// mein save hote hain (deals worker ki tarah wahi format). Agar
// purana order hai jahan ye columns null hain, original_price vs
// price se ek approximate % nikal lete hain taake badge phir bhi
// dikh jaye.
// ==========================================

function dealLabel(type, value) {
    if (!type || value === null || value === undefined) return null;
    return type === '%' ? `${value}% OFF` : `$${value} OFF`;
}

function enrichOrderItem(item) {
    // Sirf tab deal treat karo jab deal_id actually set ho — original_price
    // column kabhi kabhi purane/stray data ki wajah se set hoti hai chahe
    // koi deal na lagi ho, is liye sirf price-difference par bharosa nahi
    // karte.
    if (!item.deal_id) {
        return { ...item, deal_label: null };
    }

    let label = dealLabel(item.deal_type, item.deal_value);

    if (!label && item.original_price && Number(item.original_price) > Number(item.price)) {
        const pct = Math.round(
            ((Number(item.original_price) - Number(item.price)) / Number(item.original_price)) * 100
        );
        label = `${pct}% OFF`;
    }

    return { ...item, deal_label: label };
}

app.get('/', (c) => c.text('AURELIA Admin API is running smoothly.'));

// ==========================================
// ADMIN AUTH
// ==========================================

app.post('/admin/auth/login', async (c) => {
    try {
        const { email, password } = await c.req.json();
        if (!email || !password) {
            return c.json({ success: false, message: 'Email and password are required.' }, 400);
        }
        if (!c.env.DB) {
            return c.json({ success: false, message: 'Database connection missing.' }, 500);
        }

        const user = await c.env.DB.prepare(
            'SELECT id, name, email, password, picture, role, status FROM users WHERE email = ?'
        )
            .bind(email)
            .first();

        // Jaan-boojh kar generic message — attacker ko yeh pata nahi chalna
        // chahiye ke email exist karta hai ya role admin nahi hai.
        if (!user || user.role !== 'admin') {
            return c.json({ success: false, message: 'Invalid credentials.' }, 401);
        }
        if (!(await verifyPassword(password, user.password))) {
            return c.json({ success: false, message: 'Invalid credentials.' }, 401);
        }
        if (user.status !== 'active') {
            return c.json({ success: false, message: 'This account is not active.' }, 403);
        }

        const token = await createAdminToken(user.id, c.env.ADMIN_JWT_SECRET);

        return c.json({ success: true, message: 'Logged in successfully', token, admin: safeAdmin(user) });
    } catch (error) {
        console.error('Admin login error:', error);
        return c.json({ success: false, message: 'Internal server error during login.' }, 500);
    }
});

app.get('/admin/auth/me', requireAdmin, async (c) => {
    try {
        const adminUserId = c.get('adminUserId');
        const user = await c.env.DB.prepare(
            'SELECT id, name, email, picture, role FROM users WHERE id = ?'
        )
            .bind(adminUserId)
            .first();

        if (!user) {
            return c.json({ authenticated: false, message: 'Admin not found' }, 404);
        }
        return c.json({ authenticated: true, admin: safeAdmin(user) });
    } catch (error) {
        console.error('Admin /me error:', error);
        return c.json({ authenticated: false, message: 'Server error' }, 500);
    }
});

app.post('/admin/auth/logout', (c) => {
    return c.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// ADMIN — USERS
// ==========================================

app.get('/admin/stats', requireAdmin, async (c) => {
    try {
        const stats = await c.env.DB.prepare(
            `SELECT
         COUNT(*) as total_users,
         SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as total_admins,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
         SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_users,
         SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_users
       FROM users`
        ).first();

        return c.json({ success: true, stats });
    } catch (error) {
        console.error('Admin stats error:', error);
        return c.json({ success: false, message: 'Failed to load stats.' }, 500);
    }
});

app.get('/admin/users', requireAdmin, async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const search = (c.req.query('search') || '').trim();
        const offset = (page - 1) * limit;

        const where = search ? 'WHERE email LIKE ? OR name LIKE ?' : '';
        const bindings = search ? [`%${search}%`, `%${search}%`] : [];

        const { results } = await c.env.DB.prepare(
            `SELECT id, email, name, picture, role, is_verified, status, last_login_at, created_at, loyalty_points
 FROM users ${where}
 ORDER BY created_at DESC
 LIMIT ? OFFSET ?`
        )
            .bind(...bindings, limit, offset)
            .all();

        const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM users ${where}`)
            .bind(...bindings)
            .first();

        return c.json({ success: true, users: results, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin users list error:', error);
        return c.json({ success: false, message: 'Failed to load users.' }, 500);
    }
});

app.patch('/admin/users/:id/role', requireAdmin, async (c) => {
    try {
        const targetId = c.req.param('id');
        const { role } = await c.req.json();

        if (!['user', 'admin'].includes(role)) {
            return c.json({ success: false, message: "Role must be 'user' or 'admin'." }, 400);
        }

        await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(role, targetId)
            .run();

        return c.json({ success: true, message: 'Role updated.' });
    } catch (error) {
        console.error('Admin role update error:', error);
        return c.json({ success: false, message: 'Failed to update role.' }, 500);
    }
});

app.patch('/admin/users/:id/status', requireAdmin, async (c) => {
    try {
        const targetId = c.req.param('id');
        const adminUserId = c.get('adminUserId');
        const { status } = await c.req.json();

        if (!['active', 'blocked', 'deleted'].includes(status)) {
            return c.json({ success: false, message: 'Invalid status.' }, 400);
        }
        if (String(targetId) === String(adminUserId)) {
            return c.json({ success: false, message: 'You cannot change your own status.' }, 400);
        }

        await c.env.DB.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(status, targetId)
            .run();

        return c.json({ success: true, message: 'Status updated.' });
    } catch (error) {
        console.error('Admin status update error:', error);
        return c.json({ success: false, message: 'Failed to update status.' }, 500);
    }
});

// ==========================================
// ADMIN — ORDERS
// ==========================================

app.get('/admin/orders', requireAdmin, async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const search = (c.req.query('search') || '').trim();
        const offset = (page - 1) * limit;

        const where = search
            ? `WHERE o.order_number LIKE ? OR u.email LIKE ? OR u.name LIKE ?`
            : '';
        const bindings = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

        const { results } = await c.env.DB.prepare(
            `SELECT o.id, o.order_number, o.user_id, o.subtotal, o.shipping, o.total,
              o.status, o.payment_method, o.created_at,
              u.name AS user_name, u.email AS user_email, u.picture AS user_picture
       FROM orders o
       LEFT JOIN users u ON u.public_id = o.user_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`
        )
            .bind(...bindings, limit, offset)
            .all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count
       FROM orders o
       LEFT JOIN users u ON u.public_id = o.user_id
       ${where}`
        )
            .bind(...bindings)
            .first();

        return c.json({ success: true, orders: results, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin orders list error:', error);
        return c.json({ success: false, message: error.message || 'Failed to load orders.', stack: error.stack }, 500);
    }
});

app.get('/admin/orders/:id', requireAdmin, async (c) => {
    try {
        const orderId = c.req.param('id');

        const order = await c.env.DB.prepare(
            `SELECT o.id, o.order_number, o.user_id, o.subtotal, o.shipping, o.total,
              o.status, o.payment_method, o.stripe_session_id, o.created_at,
              o.discount_amount, o.points_redeemed, o.coupon_code, o.coupon_discount,
              u.name AS user_name, u.email AS user_email, u.picture AS user_picture
       FROM orders o
       LEFT JOIN users u ON u.public_id = o.user_id
       WHERE o.id = ?`
        )
            .bind(orderId)
            .first();

        if (!order) {
            return c.json({ success: false, message: 'Order not found.' }, 404);
        }

        const { results: items } = await c.env.DB.prepare(
            `SELECT id, product_id, name, price, image, quantity, line_total,
              deal_id, deal_name, original_price, deal_type, deal_value
       FROM order_items WHERE order_id = ?`
        )
            .bind(orderId)
            .all();

        return c.json({ success: true, order, items: (items || []).map(enrichOrderItem) });
    } catch (error) {
        console.error('Admin order detail error:', error);
        return c.json({ success: false, message: error.message || 'Failed to load order.', stack: error.stack }, 500);
    }
});

// ==========================================
// ADMIN — LOYALTY POINTS
// ==========================================

app.get('/admin/loyalty/settings', requireAdmin, async (c) => {
    try {
        let settings = await c.env.DB.prepare('SELECT * FROM loyalty_settings WHERE id = 1').first();
        if (!settings) {
            await c.env.DB.prepare(
                `INSERT INTO loyalty_settings (id, earn_rate, redeem_rate, min_redeem_points, max_redeem_percent, is_enabled)
                 VALUES (1, 10, 100, 200, 50, 1)`
            ).run();
            settings = await c.env.DB.prepare('SELECT * FROM loyalty_settings WHERE id = 1').first();
        }
        return c.json({ success: true, settings });
    } catch (error) {
        console.error('Loyalty settings fetch error:', error);
        return c.json({ success: false, message: 'Failed to load loyalty settings.' }, 500);
    }
});

app.put('/admin/loyalty/settings', requireAdmin, async (c) => {
    try {
        const { earn_rate, redeem_rate, min_redeem_points, max_redeem_percent, is_enabled } = await c.req.json();

        if ([earn_rate, redeem_rate, min_redeem_points, max_redeem_percent].some(
            (v) => v === undefined || v === null || Number(v) < 0 || Number.isNaN(Number(v))
        )) {
            return c.json({ success: false, message: 'Sab rates/thresholds valid, non-negative numbers hone chahiye.' }, 400);
        }
        if (Number(max_redeem_percent) > 100) {
            return c.json({ success: false, message: 'Max redeem percent 100 sa zyada nahi ho sakta.' }, 400);
        }

        await c.env.DB.prepare(
            `INSERT INTO loyalty_settings (id, earn_rate, redeem_rate, min_redeem_points, max_redeem_percent, is_enabled, updated_at)
             VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
               earn_rate = excluded.earn_rate,
               redeem_rate = excluded.redeem_rate,
               min_redeem_points = excluded.min_redeem_points,
               max_redeem_percent = excluded.max_redeem_percent,
               is_enabled = excluded.is_enabled,
               updated_at = CURRENT_TIMESTAMP`
        ).bind(
            Number(earn_rate), Number(redeem_rate), Number(min_redeem_points),
            Number(max_redeem_percent), is_enabled ? 1 : 0
        ).run();

        const settings = await c.env.DB.prepare('SELECT * FROM loyalty_settings WHERE id = 1').first();
        return c.json({ success: true, message: 'Loyalty settings update ho gayi.', settings });
    } catch (error) {
        console.error('Loyalty settings update error:', error);
        return c.json({ success: false, message: 'Settings update nahi ho saki.' }, 500);
    }
});

// Manual points adjustment — admin kisi bhi user ka balance +/- kar sakta hai
app.post('/admin/users/:id/loyalty/adjust', requireAdmin, async (c) => {
    try {
        const targetId = c.req.param('id');
        const adminUserId = c.get('adminUserId');
        const { points, note } = await c.req.json();

        const delta = Number(points);
        if (!Number.isFinite(delta) || delta === 0) {
            return c.json({ success: false, message: 'Points ek non-zero number honi chahiye.' }, 400);
        }
        if (!note || !note.trim()) {
            return c.json({ success: false, message: 'Manual adjustment k liye reason/note zaroori hai.' }, 400);
        }

        const user = await c.env.DB.prepare('SELECT id, loyalty_points FROM users WHERE id = ?').bind(targetId).first();
        if (!user) return c.json({ success: false, message: 'User nahi mila.' }, 404);

        const currentBalance = Number(user.loyalty_points) || 0;
        const newBalance = currentBalance + delta;
        if (newBalance < 0) {
            return c.json({ success: false, message: `User ke current balance (${currentBalance}) sa zyada deduct nahi ho sakta.` }, 400);
        }

        await c.env.DB.batch([
            c.env.DB.prepare('UPDATE users SET loyalty_points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(newBalance, targetId),
            c.env.DB.prepare(
                `INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, note, created_by)
                 VALUES (?, NULL, 'adjust', ?, ?, ?, ?)`
            ).bind(targetId, delta, newBalance, note.trim(), adminUserId),
        ]);

        return c.json({ success: true, message: 'Points adjust ho gaye.', balance: newBalance });
    } catch (error) {
        console.error('Loyalty adjust error:', error);
        return c.json({ success: false, message: 'Points adjust nahi ho sakay.' }, 500);
    }
});

app.get('/admin/loyalty/transactions', requireAdmin, async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const search = (c.req.query('search') || '').trim();
        const offset = (page - 1) * limit;

        const where = search ? 'WHERE u.email LIKE ? OR u.name LIKE ?' : '';
        const bindings = search ? [`%${search}%`, `%${search}%`] : [];

        const { results } = await c.env.DB.prepare(
            `SELECT lt.id, lt.user_id, lt.order_id, lt.type, lt.points, lt.balance_after, lt.note, lt.created_at,
                    u.name AS user_name, u.email AS user_email, o.order_number
             FROM loyalty_transactions lt
             LEFT JOIN users u ON u.id = lt.user_id
             LEFT JOIN orders o ON o.id = lt.order_id
             ${where}
             ORDER BY lt.created_at DESC
             LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM loyalty_transactions lt LEFT JOIN users u ON u.id = lt.user_id ${where}`
        ).bind(...bindings).first();

        return c.json({ success: true, transactions: results || [], total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Loyalty transactions list error:', error);
        return c.json({ success: false, message: 'Transactions load nahi ho sakin.' }, 500);
    }
});

// ==========================================
// ADMIN — COUPONS
// ==========================================

function couponLabel(coupon) {
    return coupon.type === '%' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`;
}

// Status stored in DB is only 'active'/'disabled' — everything else
// (scheduled/expired) is derived here from the date window + usage limit,
// so a single toggle doesn't need to be kept in sync with the calendar.
function deriveCouponStatus(coupon) {
    if (coupon.status !== 'active') return 'disabled';

    const now = new Date();
    if (coupon.starts_at && now < new Date(coupon.starts_at)) return 'scheduled';
    if (coupon.expires_at && now > new Date(coupon.expires_at)) return 'expired';
    if (
        coupon.usage_limit !== null && coupon.usage_limit !== undefined &&
        Number(coupon.used_count) >= Number(coupon.usage_limit)
    ) {
        return 'expired';
    }
    return 'active';
}

app.get('/admin/coupons', requireAdmin, async (c) => {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const offset = (page - 1) * limit;
        const search = (c.req.query('search') || '').trim();

        const conditions = [];
        const bindings = [];
        if (search) { conditions.push('(code LIKE ? OR description LIKE ?)'); bindings.push(`%${search}%`, `%${search}%`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM coupons ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count FROM coupons ${where}`
        ).bind(...bindings).first();

        let coupons = (results || []).map((coupon) => ({
            ...coupon,
            label: couponLabel(coupon),
            derived_status: deriveCouponStatus(coupon),
        }));

        // Optional status filter applies on the DERIVED status (client can't
        // filter for "scheduled"/"expired" via a plain SQL WHERE otherwise).
        const statusFilter = c.req.query('status');
        if (statusFilter) {
            coupons = coupons.filter((coupon) => coupon.derived_status === statusFilter);
        }

        return c.json({ success: true, coupons, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin coupons list error:', error);
        return c.json({ success: false, message: `Failed to load coupons: ${error.message}` }, 500);
    }
});

app.get('/admin/coupons/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const coupon = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first();
        if (!coupon) return c.json({ success: false, message: 'Coupon not found.' }, 404);

        const statsRow = await c.env.DB.prepare(
            'SELECT COUNT(*) as times_used, COALESCE(SUM(discount_amount), 0) as total_discount_given FROM coupon_usages WHERE coupon_id = ?'
        ).bind(id).first();

        return c.json({
            success: true,
            coupon: {
                ...coupon,
                label: couponLabel(coupon),
                derived_status: deriveCouponStatus(coupon),
                times_used: statsRow?.times_used || 0,
                total_discount_given: statsRow?.total_discount_given || 0,
            },
        });
    } catch (error) {
        return c.json({ success: false, message: `Failed to load coupon: ${error.message}` }, 500);
    }
});

app.post('/admin/coupons', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const {
            code, description, type, value,
            min_order_amount, max_discount_amount,
            starts_at, expires_at, usage_limit, per_user_limit, status,
        } = body;

        if (!code || !code.trim()) {
            return c.json({ success: false, message: 'Coupon code zaroori hai.' }, 400);
        }
        if (value === undefined || value === null || isNaN(Number(value)) || Number(value) <= 0) {
            return c.json({ success: false, message: 'Coupon value zaroori hai aur 0 sa zyada honi chahiye.' }, 400);
        }
        if (!['%', '$'].includes(type)) {
            return c.json({ success: false, message: "Coupon type '%' ya '$' hona chahiye." }, 400);
        }
        if (type === '%' && Number(value) > 100) {
            return c.json({ success: false, message: 'Percentage discount 100 sa zyada nahi ho sakta.' }, 400);
        }

        let result;
        try {
            result = await c.env.DB.prepare(
                `INSERT INTO coupons
                    (code, description, type, value, min_order_amount, max_discount_amount,
                     starts_at, expires_at, usage_limit, per_user_limit, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                code.trim().toUpperCase(),
                description || null,
                type,
                Number(value),
                Number(min_order_amount) || 0,
                max_discount_amount !== undefined && max_discount_amount !== null && max_discount_amount !== '' ? Number(max_discount_amount) : null,
                starts_at || null,
                expires_at || null,
                usage_limit !== undefined && usage_limit !== null && usage_limit !== '' ? Number(usage_limit) : null,
                per_user_limit !== undefined && per_user_limit !== null && per_user_limit !== '' ? Number(per_user_limit) : null,
                status || 'active'
            ).run();
        } catch (dbError) {
            if (String(dbError.message).includes('UNIQUE')) {
                return c.json({ success: false, message: 'Ye coupon code pehle se maujood hai.' }, 400);
            }
            throw dbError;
        }

        return c.json({ success: true, message: 'Coupon created.', id: result.meta.last_row_id });
    } catch (error) {
        console.error('Admin coupon create error:', error);
        return c.json({ success: false, message: `Failed to create coupon: ${error.message}` }, 500);
    }
});

app.patch('/admin/coupons/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const existing = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first();
        if (!existing) return c.json({ success: false, message: 'Coupon not found.' }, 404);

        if (body.type && !['%', '$'].includes(body.type)) {
            return c.json({ success: false, message: "Coupon type '%' ya '$' hona chahiye." }, 400);
        }
        if (body.value !== undefined && (isNaN(Number(body.value)) || Number(body.value) <= 0)) {
            return c.json({ success: false, message: 'Coupon value 0 sa zyada honi chahiye.' }, 400);
        }

        const fields = [
            'description', 'type', 'value', 'min_order_amount', 'max_discount_amount',
            'starts_at', 'expires_at', 'usage_limit', 'per_user_limit', 'status',
        ];
        const updates = [];
        const bindings = [];

        if ('code' in body && body.code && body.code.trim()) {
            updates.push('code = ?');
            bindings.push(body.code.trim().toUpperCase());
        }

        for (const field of fields) {
            if (field in body) {
                const raw = body[field];
                const isNullable = ['max_discount_amount', 'starts_at', 'expires_at', 'usage_limit', 'per_user_limit'].includes(field);
                updates.push(`${field} = ?`);
                bindings.push(isNullable && (raw === '' || raw === undefined) ? null : raw);
            }
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            bindings.push(id);
            try {
                await c.env.DB.prepare(`UPDATE coupons SET ${updates.join(', ')} WHERE id = ?`)
                    .bind(...bindings)
                    .run();
            } catch (dbError) {
                if (String(dbError.message).includes('UNIQUE')) {
                    return c.json({ success: false, message: 'Ye coupon code pehle se maujood hai.' }, 400);
                }
                throw dbError;
            }
        }

        return c.json({ success: true, message: 'Coupon updated.' });
    } catch (error) {
        console.error('Admin coupon update error:', error);
        return c.json({ success: false, message: `Failed to update coupon: ${error.message}` }, 500);
    }
});

app.delete('/admin/coupons/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        // coupon_usages ON DELETE CASCADE se apne aap clean ho jayenge.
        await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: 'Coupon deleted.' });
    } catch (error) {
        console.error('Admin coupon delete error:', error);
        return c.json({ success: false, message: `Failed to delete coupon: ${error.message}` }, 500);
    }
});

export default app;