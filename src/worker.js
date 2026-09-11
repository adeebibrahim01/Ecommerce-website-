import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// ==========================================
// PASSWORD HASHING (PBKDF2 via Web Crypto)
// ==========================================

const PBKDF2_ITERATIONS = 100000;

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToBase64(salt)}$${bufToBase64(derivedBits)}`;
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
// SESSION TOKENS (HMAC-signed, stateless)
// ==========================================

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

async function createSessionToken(userId, secret) {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_SECONDS * 1000 });
  const encodedPayload = toBase64Url(payload);
  const signature = await hmacSign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySessionToken(token, secret) {
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

const getUserIdFromAuth = async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  return verifySessionToken(token, c.env.JWT_SECRET);
};

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  picture: user.picture,
  role: user.role,
  is_verified: !!user.is_verified,
});

// ==========================================
// ADMIN GUARD
// Verifies the token AND checks the role column in the DB (never trust a
// role claim from the client — always re-read it from the users table).
// Attaches the resolved user row to c.set('adminUser', ...) for handlers.
// ==========================================

async function requireAdmin(c, next) {
  const userId = await getUserIdFromAuth(c);
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
// EMAIL VERIFICATION (OTP via Resend)
// ==========================================

const OTP_TTL_MINUTES = 10;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(env, toEmail, name, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || 'AURELIA <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Verify your AURELIA account',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#432817;">Welcome to AURELIA, ${name}!</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#432817;">${code}</p>
          <p style="color:#7E7E86; font-size: 13px;">This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't create this account, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Resend email error:', errText);
    throw new Error('Failed to send verification email');
  }
}

// 1. Root route check
app.get('/', (c) => c.text('AURELIA Auth & User API is running smoothly.'));

// ==========================================
// MANUAL SIGNUP & LOGIN APIS
// ==========================================

app.post('/auth/signup', async (c) => {
  try {
    const { name, email, password } = await c.req.json();

    if (!name || !email || !password) {
      return c.json({ success: false, message: 'Name, email, and password are required.' }, 400);
    }
    if (password.length < 8) {
      return c.json({ success: false, message: 'Password must be at least 8 characters.' }, 400);
    }
    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingUser) {
      return c.json({ success: false, message: 'Email is already registered.' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const result = await c.env.DB.prepare(
      `INSERT INTO users (name, email, password, role, is_verified, status, verification_code, verification_code_expires_at)
       VALUES (?, ?, ?, 'user', 0, 'active', ?, ?)`
    )
      .bind(name, email, passwordHash, otpCode, otpExpiresAt)
      .run();

    const newUserId = result.meta.last_row_id;
    const token = await createSessionToken(newUserId, c.env.JWT_SECRET);

    try {
      await sendVerificationEmail(c.env, email, name, otpCode);
    } catch (emailErr) {
      console.error('Could not send verification email:', emailErr);
    }

    return c.json({
      success: true,
      message: 'Account created! Please check your email for the verification code.',
      token,
      user: { id: newUserId, name, email, picture: '', role: 'user', is_verified: false },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ success: false, message: 'Internal server error during signup.' }, 500);
  }
});

app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ success: false, message: 'Email and password are required.' }, 400);
    }
    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, name, email, password, picture, role, is_verified, status FROM users WHERE email = ?'
    )
      .bind(email)
      .first();

    if (!user || !(await verifyPassword(password, user.password))) {
      return c.json({ success: false, message: 'Invalid email or password.' }, 401);
    }

    if (user.status !== 'active') {
      return c.json({ success: false, message: 'This account is not active. Contact support.' }, 403);
    }

    await c.env.DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(user.id)
      .run();

    const token = await createSessionToken(user.id, c.env.JWT_SECRET);

    if (!user.is_verified) {
      const otpCode = generateOTP();
      const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

      await c.env.DB.prepare(
        'UPDATE users SET verification_code = ?, verification_code_expires_at = ? WHERE id = ?'
      )
        .bind(otpCode, otpExpiresAt, user.id)
        .run();

      try {
        await sendVerificationEmail(c.env, user.email, user.name, otpCode);
      } catch (emailErr) {
        console.error('Could not send verification email on login:', emailErr);
      }

      return c.json({
        success: true,
        message: 'Please verify your email. A new code has been sent.',
        token,
        user: safeUser(user),
      });
    }

    return c.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: safeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, message: 'Internal server error during login.' }, 500);
  }
});

// ==========================================
// GOOGLE OAUTH APIS
// ==========================================

app.get('/auth/google', (c) => {
  const requestUrl = new URL(c.req.url);
  const redirectUri = `${requestUrl.origin}/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    prompt: 'select_account',
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
  const requestUrl = new URL(c.req.url);
  const redirectUri = `${requestUrl.origin}/auth/google/callback`;

  if (!code) {
    return c.redirect(`${frontendUrl}/login?error=missing_code`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return c.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.id || !googleUser.email) {
      return c.redirect(`${frontendUrl}/login?error=user_info_failed`);
    }

    if (!c.env.DB) {
      return c.redirect(`${frontendUrl}/login?error=database_missing`);
    }

    await c.env.DB.prepare(
      `INSERT INTO users (google_id, email, name, picture, role, is_verified, status, last_login_at)
       VALUES (?, ?, ?, ?, 'user', 1, 'active', CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET
         google_id = excluded.google_id,
         name = excluded.name,
         picture = excluded.picture,
         is_verified = 1,
         last_login_at = CURRENT_TIMESTAMP`
    )
      .bind(googleUser.id, googleUser.email, googleUser.name || '', googleUser.picture || '')
      .run();

    const dbUser = await c.env.DB.prepare('SELECT id, status FROM users WHERE email = ?')
      .bind(googleUser.email)
      .first();

    if (dbUser.status !== 'active') {
      return c.redirect(`${frontendUrl}/login?error=account_not_active`);
    }

    const authToken = await createSessionToken(dbUser.id, c.env.JWT_SECRET);
    return c.redirect(`${frontendUrl}/login?token=${authToken}`);
  } catch (err) {
    console.error('Error during Google OAuth:', err);
    return c.redirect(`${frontendUrl}/login?error=auth_internal_error`);
  }
});

// ==========================================
// USER PROFILE & DATA MANAGEMENT APIS
// ==========================================

app.get('/auth/me', async (c) => {
  const userId = await getUserIdFromAuth(c);

  if (!userId) {
    return c.json({ authenticated: false, message: 'Unauthorized' }, 401);
  }

  try {
    if (!c.env.DB) {
      return c.json({ authenticated: false, message: 'Database missing' }, 500);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, google_id, email, name, picture, role, is_verified, status FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    if (!user || user.status !== 'active') {
      return c.json({ authenticated: false, message: 'User not found or inactive' }, 404);
    }

    return c.json({ authenticated: true, user: safeUser(user) });
  } catch (error) {
    console.error('Database fetch error:', error);
    return c.json({ authenticated: false, message: 'Server database error' }, 500);
  }
});

app.post('/auth/verify-email', async (c) => {
  const userId = await getUserIdFromAuth(c);
  if (!userId) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const { code } = await c.req.json();
    if (!code) {
      return c.json({ success: false, message: 'Verification code is required.' }, 400);
    }
    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    const user = await c.env.DB.prepare(
      'SELECT is_verified, verification_code, verification_code_expires_at FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ success: false, message: 'User not found.' }, 404);
    }
    if (user.is_verified) {
      return c.json({ success: true, message: 'Email is already verified.' });
    }
    if (!user.verification_code || user.verification_code !== code) {
      return c.json({ success: false, message: 'Invalid verification code.' }, 400);
    }
    if (!user.verification_code_expires_at || new Date(user.verification_code_expires_at) < new Date()) {
      return c.json({ success: false, message: 'Code has expired. Please request a new one.' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE users
       SET is_verified = 1, verification_code = NULL, verification_code_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(userId)
      .run();

    return c.json({ success: true, message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Verify email error:', error);
    return c.json({ success: false, message: 'Internal server error during verification.' }, 500);
  }
});

app.post('/auth/resend-verification', async (c) => {
  const userId = await getUserIdFromAuth(c);
  if (!userId) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    const user = await c.env.DB.prepare('SELECT name, email, is_verified FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ success: false, message: 'User not found.' }, 404);
    }
    if (user.is_verified) {
      return c.json({ success: true, message: 'Email is already verified.' });
    }

    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    await c.env.DB.prepare(
      'UPDATE users SET verification_code = ?, verification_code_expires_at = ? WHERE id = ?'
    )
      .bind(otpCode, otpExpiresAt, userId)
      .run();

    await sendVerificationEmail(c.env, user.email, user.name, otpCode);

    return c.json({ success: true, message: 'A new verification code has been sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return c.json({ success: false, message: 'Failed to resend verification code.' }, 500);
  }
});

app.put('/user/update', async (c) => {
  const userId = await getUserIdFromAuth(c);
  if (!userId) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const { name, picture } = await c.req.json();
    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database missing' }, 500);
    }

    await c.env.DB.prepare(
      'UPDATE users SET name = COALESCE(?, name), picture = COALESCE(?, picture), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(name, picture, userId)
      .run();

    return c.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ success: false, message: 'Failed to update profile' }, 500);
  }
});

app.post('/auth/logout', (c) => {
  return c.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// ADMIN PORTAL APIS  (all guarded by requireAdmin)
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
// ADMIN ORDERS APIS
// ==========================================

app.get('/admin/orders', requireAdmin, async (c) => {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    const search = (c.req.query('search') || '').trim();
    const offset = (page - 1) * limit;

    // order_items/orders ka user_id TEXT ke tor par store hota hai (String(userId)),
    // jabke users.id integer hai — isliye CAST karke match karwaya hai.
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


export default app;