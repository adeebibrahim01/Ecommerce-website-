import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => origin || '*',
        allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
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
            `SELECT id, email, name, picture, role, is_verified, status, last_login_at, created_at
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
              u.name as user_name, u.email as user_email
       FROM orders o
       LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`
        )
            .bind(...bindings, limit, offset)
            .all();

        const totalRow = await c.env.DB.prepare(
            `SELECT COUNT(*) as count
       FROM orders o
       LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id
       ${where}`
        )
            .bind(...bindings)
            .first();

        return c.json({ success: true, orders: results, total: totalRow?.count || 0, page, limit });
    } catch (error) {
        console.error('Admin orders list error:', error);
        return c.json({ success: false, message: 'Failed to load orders.' }, 500);
    }
});

app.get('/admin/orders/:id', requireAdmin, async (c) => {
    try {
        const orderId = c.req.param('id');

        const order = await c.env.DB.prepare(
            `SELECT o.id, o.order_number, o.user_id, o.subtotal, o.shipping, o.total,
              o.status, o.payment_method, o.stripe_session_id, o.created_at,
              u.name as user_name, u.email as user_email
       FROM orders o
       LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id
       WHERE o.id = ?`
        )
            .bind(orderId)
            .first();

        if (!order) {
            return c.json({ success: false, message: 'Order not found.' }, 404);
        }

        const { results: items } = await c.env.DB.prepare(
            `SELECT id, product_id, name, price, image, quantity, line_total
       FROM order_items WHERE order_id = ?`
        )
            .bind(orderId)
            .all();

        return c.json({ success: true, order, items: items || [] });
    } catch (error) {
        console.error('Admin order detail error:', error);
        return c.json({ success: false, message: 'Failed to load order.' }, 500);
    }
});

export default app;