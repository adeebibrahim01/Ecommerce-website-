// Cloudflare Worker Handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Google Auth Trigger Route
    if (url.pathname === "/auth/google") {
      const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

      googleAuthUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
      // Callback URL points back to Worker or Frontend
      googleAuthUrl.searchParams.set("redirect_uri", `${env.WORKER_URL}/auth/google/callback`);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("access_type", "offline");

      // Direct Redirect to Google
      return Response.redirect(googleAuthUrl.toString(), 302);
    }

    // 2. Google Auth Callback Route
    if (url.pathname === "/auth/google/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Authorization code missing", { status: 400 });

      // Code ko exchange karke Google se user details lein
      // Phir frontend (localhost ya live site) par token ke sath redirect karein:
      const frontendRedirectUrl = `${env.FRONTEND_URL}/login?token=GENERATED_TOKEN_HERE`;
      return Response.redirect(frontendRedirectUrl, 302);
    }

    return new Response("Not Found", { status: 404 });
  }
};