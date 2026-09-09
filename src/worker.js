import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Dynamic CORS handling for Frontend requests
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Helper function to extract user token/ID safely from Authorization Header
const getUserIdFromAuth = (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;
  return authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
};

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

    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database connection missing.' }, 500);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingUser) {
      return c.json({ success: false, message: 'Email is already registered.' }, 400);
    }

    // Generate a unique user ID (e.g., timestamp or random string)
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Insert new user into D1 Database
    // Note: In production, hash the password (e.g., using bcrypt/web crypto). Storing plain text for simplicity.
    await c.env.DB.prepare(
      `INSERT INTO users (id, name, email, password, picture) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(userId, name, email, password, '')
    .run();

    return c.json({
      success: true,
      message: 'Account created successfully!',
      userId: userId,
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

    // Find user by email
    const user = await c.env.DB.prepare(
      'SELECT id, name, email, password, picture FROM users WHERE email = ?'
    )
    .bind(email)
    .first();

    if (!user) {
      return c.json({ success: false, message: 'Invalid email or password.' }, 401);
    }

    // Simple password check (match with stored password)
    if (user.password !== password) {
      return c.json({ success: false, message: 'Invalid email or password.' }, 401);
    }

    return c.json({
      success: true,
      message: 'Logged in successfully',
      token: user.id, // Returning user ID as auth token
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
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

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return c.redirect(googleAuthUrl);
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

    if (c.env.DB) {
      await c.env.DB.prepare(
        `INSERT INTO users (id, google_id, email, name, picture)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name = excluded.name,
           picture = excluded.picture`
      )
      .bind(
        googleUser.id,
        googleUser.id,
        googleUser.email,
        googleUser.name || '',
        googleUser.picture || ''
      )
      .run();
    }

    const authToken = googleUser.id;
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
  const userId = getUserIdFromAuth(c);

  if (!userId) {
    return c.json({ authenticated: false, message: 'Unauthorized' }, 401);
  }

  try {
    if (!c.env.DB) {
      return c.json({ authenticated: true, user: { id: userId } });
    }

    const user = await c.env.DB.prepare(
      'SELECT id, google_id, email, name, picture FROM users WHERE id = ? OR google_id = ?'
    )
    .bind(userId, userId)
    .first();

    if (!user) {
      return c.json({ authenticated: false, message: 'User not found' }, 404);
    }

    return c.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error('Database fetch error:', error);
    return c.json({ authenticated: false, message: 'Server database error' }, 500);
  }
});

// 7. Update User Profile Data (/user/update)
app.put('/user/update', async (c) => {
  const userId = getUserIdFromAuth(c);
  if (!userId) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const { name, picture } = await c.req.json();
    if (!c.env.DB) {
      return c.json({ success: false, message: 'Database missing' }, 500);
    }

    await c.env.DB.prepare(
      'UPDATE users SET name = COALESCE(?, name), picture = COALESCE(?, picture) WHERE id = ? OR google_id = ?'
    )
    .bind(name, picture, userId, userId)
    .run();

    return c.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ success: false, message: 'Failed to update profile' }, 500);
  }
});

// 8. Logout Route
app.post('/auth/logout', (c) => {
  return c.json({ success: true, message: 'Logged out successfully' });
});

export default app;