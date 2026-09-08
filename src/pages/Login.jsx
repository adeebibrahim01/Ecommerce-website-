import LoginForm from "../components/auth/LoginForm";

function Login() {
  return (
    <main className="min-h-screen bg-fashion-bg text-fashion-dark">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left — Fashion Image / Brand Area */}
        <section className="relative hidden min-h-screen overflow-hidden lg:block">
          {/* Background image */}
          <img
            src="/images/login-fashion.jpg"
            alt="Fashion collection"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Soft overlay */}
          <div className="absolute inset-0 bg-fashion-dark/20" />

          {/* Brand */}
          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            <div>
              <span className="font-serif text-3xl tracking-wide text-white">
                MODA
              </span>
            </div>

            <div className="max-w-md">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-white/80">
                Timeless fashion
              </p>

              <h2 className="font-serif text-5xl font-medium leading-[1.05] text-white xl:text-6xl">
                Style that speaks
                <br />
                for itself.
              </h2>

              <p className="mt-6 max-w-sm text-sm leading-6 text-white/80">
                Discover carefully curated pieces designed to become part of
                your everyday style.
              </p>
            </div>
          </div>
        </section>

        {/* Right — Login */}
        <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-20">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="mb-12 lg:hidden">
              <span className="font-serif text-3xl tracking-wide text-fashion-dark">
                MODA
              </span>
            </div>

            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;