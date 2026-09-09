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
app.get('/', (c) => c.text('AURELIA Auth API is running smoothly.'));

// 2. Google OAuth Trigger Route
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

// 3. OAuth Callback Route
app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
  const requestUrl = new URL(c.req.url);
  const redirectUri = `${requestUrl.origin}/auth/google/callback`;

  if (!code) {
    return c.redirect(`${frontendUrl}/login?error=missing_code`);
  }

  try {
    // Exchange Auth Code for Access Token
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
      console.error('Token Exchange Failed:', tokenData);
      return c.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    // Fetch Google User Profile Information
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.id || !googleUser.email) {
      return c.redirect(`${frontendUrl}/login?error=user_info_failed`);
    }

    // Upsert User into Cloudflare D1 Database
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

    // Create token payload for frontend redirect
    const authToken = googleUser.id;
    return c.redirect(`${frontendUrl}/login?token=${authToken}`);

  } catch (err) {
    console.error('Error during Google OAuth:', err);
    return c.redirect(`${frontendUrl}/login?error=auth_internal_error`);
  }
});

// 4. Current User Verification Route (/auth/me)
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

// 5. Logout Route
app.post('/auth/logout', (c) => {
  return c.json({ success: true, message: 'Logged out successfully' });
});

export default app;