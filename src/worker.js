import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// ==========================================
// PASSWORD HASHING (PBKDF2 via Web Crypto)
// bcrypt needs native bindings which Cloudflare Workers doesn't support.
// PBKDF2-SHA256 with 100k iterations is the standard edge-safe alternative.
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

  // constant-time compare
  if (actualHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

// ==========================================
// SESSION TOKENS (HMAC-signed, stateless)
// Old code was returning the raw userId as the "token" — anyone could
// impersonate any user by just sending their id. This signs it instead.
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

// Reads + verifies the token from the Authorization header. Returns userId or null.
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

// 1. Root route check
app.get('/', (c) => c.text('AURELIA Auth & User API is running smoothly.'));

// ==========================================
// MANUAL SIGNUP & LOGIN APIS
// ==========================================

// 2. Manual Signup API (/auth/signup)
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

    const result = await c.env.DB.prepare(
      `INSERT INTO users (name, email, password, role, is_verified, status)
       VALUES (?, ?, ?, 'user', 0, 'active')`
    )
      .bind(name, email, passwordHash)
      .run();

    const newUserId = result.meta.last_row_id;
    const token = await createSessionToken(newUserId, c.env.JWT_SECRET);

    return c.json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: newUserId, name, email, picture: '', role: 'user', is_verified: false },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ success: false, message: 'Internal server error during signup.' }, 500);
  }
});

// 3. Manual Login API (/auth/login)
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

    // Same generic message whether email doesn't exist or password is wrong —
    // don't leak which one it was.
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

// 4. Google OAuth Trigger Route
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

// 5. OAuth Callback Route
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

    // Google already verifies email ownership, so is_verified = 1 here.
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

// 6. Current User Verification Route (/auth/me)
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

// 7. Update User Profile Data (/user/update)
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

// 8. Logout Route
// Tokens are stateless (HMAC-signed) so there's nothing to invalidate server-side.
// The frontend clearing localStorage is what actually "logs out" the user.
app.post('/auth/logout', (c) => {
  return c.json({ success: true, message: 'Logged out successfully' });
});

export default app;