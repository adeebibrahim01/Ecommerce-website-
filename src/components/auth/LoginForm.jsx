import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function LoginForm() {
  const { user, loginWithGoogle, isLoading } = useAuth();
  const navigate = useNavigate();

  // Already logged in → Home page par redirect karein
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Handle Dynamic Google Auth Redirection
  const handleGoogleLogin = () => {
    if (typeof loginWithGoogle === "function") {
      loginWithGoogle();
    } else {
      // Fallback direct redirection to Cloudflare Worker OAuth endpoint
      window.location.href = `${window.location.origin}/auth/google`;
    }
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EDE6DA]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#432817] border-t-transparent" />
          <p className="text-xs tracking-[0.25em] text-[#7E7E86] uppercase">
            Loading
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#EDE6DA] text-[#432817]">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* =====================================================
            LEFT — FASHION IMAGE
        ====================================================== */}
        <section className="relative hidden min-h-screen overflow-hidden lg:block">
          {/* Online fashion image */}
          <img
            src="https://images.unsplash.com/photo-1772714601004-23b94ae3913d?auto=format&fit=crop&fm=jpg&q=85&w=1600"
            alt="Editorial fashion"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Warm overlay */}
          <div className="absolute inset-0 bg-[#432817]/10" />

          {/* Top logo */}
          <div className="absolute left-10 top-9 z-10">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-serif text-2xl tracking-[0.18em] text-white"
            >
              AURELIA
            </button>
          </div>

          {/* Editorial text */}
          <div className="absolute bottom-10 left-10 right-10 z-10 text-white">
            <p className="mb-4 text-[10px] font-medium tracking-[0.4em] uppercase">
              New Season · 2026
            </p>

            <h2 className="max-w-lg font-serif text-5xl leading-[0.95] tracking-tight xl:text-6xl">
              Elegance
              <br />
              in every
              <br />
              detail.
            </h2>

            <div className="mt-7 flex items-center gap-4">
              <span className="h-px w-12 bg-white/70" />
              <p className="text-xs tracking-[0.18em] uppercase">
                Discover your style
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            RIGHT — LOGIN
        ====================================================== */}
        <section className="relative flex min-h-screen flex-col">

          {/* Mobile Header */}
          <header className="flex items-center justify-between px-6 py-7 lg:hidden">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-serif text-xl tracking-[0.16em]"
            >
              AURELIA
            </button>

            <span className="text-[10px] tracking-[0.25em] text-[#7E7E86] uppercase">
              Account
            </span>
          </header>

          {/* Main content */}
          <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
            <div className="w-full max-w-md">

              {/* Small label */}
              <div className="mb-7 flex items-center gap-3">
                <span className="h-px w-8 bg-[#977150]" />
                <span className="text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
                  Welcome back
                </span>
              </div>

              {/* Heading */}
              <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-[#432817] sm:text-6xl">
                Sign in
              </h1>

              {/* Description */}
              <p className="mt-6 max-w-sm text-sm leading-7 text-[#7E7E86]">
                Enter your world of timeless fashion, curated collections,
                and effortless style.
              </p>

              {/* Divider */}
              <div className="my-10 h-px w-full bg-[#D1B79E]/60" />

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="group flex w-full items-center justify-center gap-4 border border-[#A78361] bg-transparent px-6 py-4 text-sm font-medium tracking-[0.08em] text-[#432817] transition-all duration-300 hover:bg-[#432817] hover:text-[#EDE6DA]"
              >
                {/* Google Icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                >
                  <path
                    d="M21.805 12.23c0-.79-.064-1.57-.203-2.31H12v4.37h5.5a4.7 4.7 0 0 1-2.04 3.09v2.57h3.3c1.93-1.78 3.045-4.4 3.045-7.72Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 22c2.755 0 5.063-.91 6.75-2.46l-3.3-2.57c-.916.61-2.087.98-3.45.98-2.655 0-4.91-1.795-5.717-4.21H2.87v2.65A10.195 10.195 0 0 0 12 22Z"
                    fill="#34A853"
                  />
                  <path
                    d="M6.283 13.74A6.12 6.12 0 0 1 5.96 12c0-.605.106-1.19.323-1.74V7.61H2.87A10 10 0 0 0 1.805 12c0 1.61.386 3.13 1.065 4.39l3.413-2.65Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 6.05c1.5 0 2.845.516 3.905 1.527l2.93-2.93C17.058 2.99 14.75 2 12 2a10.195 10.195 0 0 0-9.13 5.61l3.413 2.65C7.09 7.845 9.345 6.05 12 6.05Z"
                    fill="#EA4335"
                  />
                </svg>

                <span>Continue with Google</span>
              </button>

              {/* Alternative divider */}
              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-[#D1B79E]/60" />
                <span className="text-[9px] tracking-[0.25em] text-[#7E7E86] uppercase">
                  Secure access
                </span>
                <div className="h-px flex-1 bg-[#D1B79E]/60" />
              </div>

              {/* Security message */}
              <div className="border border-[#D1B79E]/50 bg-[#EDE6DA]/50 px-5 py-4">
                <div className="flex gap-3">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 shrink-0 text-[#977150]"
                  >
                    <path
                      d="M12 3 5 6v5c0 4.65 2.98 8.99 7 10 4.02-1.01 7-5.35 7-10V6l-7-3Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="m9 12 2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <p className="text-xs leading-5 text-[#7E7E86]">
                    Your account is securely authenticated with Google.
                    We never store your Google password.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-10 text-center">
                <p className="text-xs text-[#7E7E86]">
                  New to AURELIA?
                </p>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="mt-2 text-xs font-medium tracking-[0.15em] text-[#432817] uppercase underline decoration-[#A78361] underline-offset-4 transition hover:text-[#977150]"
                >
                  Create an account
                </button>
              </div>
            </div>
          </div>

          {/* Bottom copyright */}
          <footer className="px-6 pb-6 text-center lg:px-10 lg:pb-8 lg:text-left">
            <p className="text-[9px] tracking-[0.2em] text-[#7E7E86] uppercase">
              © 2026 AURELIA · All rights reserved
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}