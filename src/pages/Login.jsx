import { useNavigate } from "react-router-dom";
import LoginForm from "../components/auth/LoginForm";

export default function Login() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#EDE6DA] text-[#432817]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* LEFT — FASHION IMAGE */}
        <section className="relative hidden min-h-screen overflow-hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1772714601004-23b94ae3913d?auto=format&fit=crop&fm=jpg&q=85&w=1600"
            alt="Editorial fashion"
            className="absolute inset-0 h-full w-full object-cover"
          />
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

          <div className="absolute bottom-10 left-10 right-10 z-10 text-white">
            <p className="mb-4 text-[10px] font-medium tracking-[0.4em] uppercase">
              New Season · 2026
            </p>
            <h2 className="max-w-lg font-serif text-5xl leading-[0.95] tracking-tight xl:text-6xl">
              Elegance <br /> in every <br /> detail.
            </h2>
            <div className="mt-7 flex items-center gap-4">
              <span className="h-px w-12 bg-white/70" />
              <p className="text-xs tracking-[0.18em] uppercase">
                Discover your style
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT — LOGIN SECTION */}
        <section className="relative flex min-h-screen flex-col justify-between px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
          {/* Mobile Header */}
          <header className="flex items-center justify-between lg:hidden">
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

          {/* Form Container */}
          <div className="flex flex-1 items-center justify-center py-8">
            <LoginForm />
          </div>

          <footer className="text-center lg:text-left">
            <p className="text-[9px] tracking-[0.2em] text-[#7E7E86] uppercase">
              © 2026 AURELIA · All rights reserved
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}