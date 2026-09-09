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
      try {
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
          return new Response(
            `OAuth Error: ${tokens.error_description}`,
            { status: 400 }
          );
        }

        if (!tokens.access_token) {
          return new Response(
            'Access Token Missing',
            { status: 400 }
          );
        }

        // Fetch User Info
        const userResponse = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );

        if (!userResponse.ok) {
          return new Response(
            'Failed to fetch Google user information.',
            { status: 400 }
          );
        }

        const userData = await userResponse.json();

        if (!userData.id || !userData.email) {
          return new Response(
            'Google user information is incomplete.',
            { status: 400 }
          );
        }

        // =====================================================
        // SAVE / UPDATE USER IN CLOUDFLARE D1
        // =====================================================

        const existingUser = await env.DB.prepare(
          `SELECT id
           FROM users
           WHERE google_id = ? OR email = ?`
        )
          .bind(
            String(userData.id),
            String(userData.email)
          )
          .first();

        let dbUserId;

        if (existingUser) {
          // Existing user → update latest Google profile information
          dbUserId = existingUser.id;

          await env.DB.prepare(
            `UPDATE users
             SET name = ?, email = ?, profile_image = ?
             WHERE id = ?`
          )
            .bind(
              userData.name ||
              userData.email.split('@')[0] ||
              'User',
              userData.email,
              userData.picture || null,
              dbUserId
            )
            .run();
        } else {
          // New user → create D1 user
          dbUserId = crypto.randomUUID();

          await env.DB.prepare(
            `INSERT INTO users (
              id,
              google_id,
              name,
              email,
              profile_image
            )
            VALUES (?, ?, ?, ?, ?)`
          )
            .bind(
              dbUserId,
              String(userData.id),
              userData.name ||
              userData.email.split('@')[0] ||
              'User',
              userData.email,
              userData.picture || null
            )
            .run();
        }

        // =====================================================
        // PREPARE USER DATA FOR FRONTEND
        // =====================================================

        const frontendUser = {
          id: dbUserId,
          google_id: String(userData.id),
          name:
            userData.name ||
            userData.email.split('@')[0] ||
            'User',
          email: userData.email,
          profile_image: userData.picture || null,
        };

        // Encode user data
        const userEncoded = encodeURIComponent(
          JSON.stringify(frontendUser)
        );

        // Dynamic redirect to frontend /login-success route
        const frontendRedirectUrl =
          `${currentOrigin}/login-success?user=${userEncoded}`;

        return Response.redirect(
          frontendRedirectUrl,
          302
        );
      } catch (error) {
        console.error(
          'OAuth callback error:',
          error
        );

        return new Response(
          `Authentication failed: ${error.message}`,
          { status: 500 }
        );
      }
    }

    // 3. Serve Frontend Static Assets (React App Pages)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Worker Active!', { status: 200 });
  },
};