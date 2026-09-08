export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // 1. GOOGLE LOGIN ROUTE
    // =========================================================
    if (url.pathname === "/auth/google") {
      const googleAuthUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri:
            "https://ecommerce-website.adeebibrahim01.workers.dev/auth/callback",
          response_type: "code",

          // Google profile information
          scope: "openid email profile",

          access_type: "offline",
          prompt: "consent",
        });

      return Response.redirect(googleAuthUrl, 302);
    }

    // =========================================================
    // 2. GOOGLE OAUTH CALLBACK
    // =========================================================
    if (url.pathname === "/auth/callback") {
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response("Authorization Code Missing", {
          status: 400,
        });
      }

      // =======================================================
      // 3. EXCHANGE AUTHORIZATION CODE FOR GOOGLE TOKENS
      // =======================================================
      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri:
              "https://ecommerce-website.adeebibrahim01.workers.dev/auth/callback",
            grant_type: "authorization_code",
          }),
        }
      );

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        return new Response(
          `OAuth Error: ${
            tokens.error_description || tokens.error
          }`,
          {
            status: 400,
          }
        );
      }

      if (!tokens.access_token) {
        return new Response("Google Access Token Missing", {
          status: 400,
        });
      }

      // =======================================================
      // 4. GET GOOGLE USER INFORMATION
      // =======================================================
      const userResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (!userResponse.ok) {
        return new Response("Failed to fetch Google user information", {
          status: 400,
        });
      }

      const userData = await userResponse.json();

      // =======================================================
      // 5. VALIDATE GOOGLE USER DATA
      // =======================================================
      if (!userData.id || !userData.email) {
        return new Response(
          "Google user information is incomplete",
          {
            status: 400,
          }
        );
      }

      // =======================================================
      // 6. NORMALIZE GOOGLE USER DATA
      // =======================================================
      const googleId = String(userData.id);
      const name = userData.name || "";
      const email = userData.email;
      const profileImage = userData.picture || null;

      // =======================================================
      // 7. SAVE USER INTO CLOUDFLARE D1
      //
      // DB binding comes from wrangler.json:
      //
      // binding: "DB"
      //
      // Table:
      // users
      // =======================================================
      try {
        await env.DB.prepare(
          `
          INSERT INTO users (
            id,
            google_id,
            name,
            email,
            profile_image
          )
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(google_id)
          DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            profile_image = excluded.profile_image
          `
        )
          .bind(
            crypto.randomUUID(),
            googleId,
            name,
            email,
            profileImage
          )
          .run();
      } catch (error) {
        console.error("D1 User Save Error:", error);

        return new Response(
          "Failed to save user to database",
          {
            status: 500,
          }
        );
      }

      // =======================================================
      // 8. GET THE FINAL USER FROM D1
      // =======================================================
      let databaseUser;

      try {
        databaseUser = await env.DB.prepare(
          `
          SELECT
            id,
            google_id,
            name,
            email,
            profile_image,
            created_at
          FROM users
          WHERE google_id = ?
          LIMIT 1
          `
        )
          .bind(googleId)
          .first();
      } catch (error) {
        console.error("D1 User Fetch Error:", error);

        return new Response(
          "Failed to fetch user from database",
          {
            status: 500,
          }
        );
      }

      if (!databaseUser) {
        return new Response(
          "User was not found in database after saving",
          {
            status: 500,
          }
        );
      }

      // =======================================================
      // 9. SEND USER DATA TO REACT
      // =======================================================
      const frontendUser = {
        id: databaseUser.id,
        google_id: databaseUser.google_id,
        name: databaseUser.name,
        email: databaseUser.email,
        profile_image: databaseUser.profile_image,
        created_at: databaseUser.created_at,
      };

      const userEncoded = encodeURIComponent(
        JSON.stringify(frontendUser)
      );

      // =======================================================
      // 10. REDIRECT TO REACT LOGIN SUCCESS PAGE
      // =======================================================
      const frontendRedirectUrl =
        `http://localhost:5173/login-success?user=${userEncoded}`;

      return Response.redirect(
        frontendRedirectUrl,
        302
      );
    }

    // =========================================================
    // DEFAULT ROUTE
    // =========================================================
    return new Response("Worker Active!");
  },
};