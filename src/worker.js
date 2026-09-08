export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Current host origin dynamically catch karein (Works for both Localhost & Cloudflare Worker URL)
    const currentOrigin = url.origin;
    const redirectUri = `${currentOrigin}/auth/callback`;

    // 1. Google Login Route
    if (url.pathname === '/auth/google') {
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          access_type: 'offline',
          prompt: 'consent'
        });

      return Response.redirect(googleAuthUrl, 302);
    }

    // 2. OAuth Callback Route
    if (url.pathname === '/auth/callback') {
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response('Authorization Code Missing', { status: 400 });
      }

      // Exchange Code for Access Token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        return new Response(`OAuth Error: ${tokens.error_description}`, { status: 400 });
      }

      // Fetch User Info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const userData = await userResponse.json();

      // Encode user data
      const userEncoded = encodeURIComponent(JSON.stringify(userData));

      // Dynamic redirect to frontend /login-success route
      const frontendRedirectUrl = `${currentOrigin}/login-success?user=${userEncoded}`;

      return Response.redirect(frontendRedirectUrl, 302);
    }

    // 3. Serve Frontend Static Assets (React App Pages)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Worker Active!', { status: 200 });
  },
};