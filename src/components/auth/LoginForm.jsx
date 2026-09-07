import { useState } from "react";

function LoginForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Replace this with your actual authentication API.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Login data:", formData);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    console.log("Continue with Google");
  };

  return (
    <div className="w-full max-w-md">
      {/* Heading */}
      <div className="mb-10">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-fashion-primary">
          Welcome back
        </p>

        <h1 className="font-serif text-4xl font-medium leading-tight text-fashion-dark sm:text-5xl">
          Sign in to your account
        </h1>

        <p className="mt-4 text-sm leading-6 text-fashion-muted">
          Enter your details below to continue shopping with us.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="mb-6">
          <label
            htmlFor="email"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-fashion-dark"
          >
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            className={`h-14 w-full border bg-transparent px-4 text-sm text-fashion-dark outline-none transition-all placeholder:text-fashion-muted/70 focus:border-fashion-primary ${
              errors.email ? "border-red-400" : "border-fashion-beige"
            }`}
          />

          {errors.email && (
            <p className="mt-2 text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-[0.12em] text-fashion-dark"
            >
              Password
            </label>

            <button
              type="button"
              className="text-xs text-fashion-primary transition-colors hover:text-fashion-brown"
              onClick={() => {
                console.log("Forgot password clicked");
              }}
            >
              Forgot password?
            </button>
          </div>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={`h-14 w-full border bg-transparent px-4 pr-14 text-sm text-fashion-dark outline-none transition-all placeholder:text-fashion-muted/70 focus:border-fashion-primary ${
                errors.password ? "border-red-400" : "border-fashion-beige"
              }`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 flex h-14 w-14 items-center justify-center text-fashion-muted transition-colors hover:text-fashion-dark"
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.98A10.45 10.45 0 0 0 2.25 12s3.5 6 9.75 6c1.46 0 2.76-.32 3.87-.83M6.23 6.23C7.8 5.45 9.7 5 12 5c6.25 0 9.75 7 9.75 7a17.9 17.9 0 0 1-2.16 2.72M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12Z"
                  />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>

          {errors.password && (
            <p className="mt-2 text-xs text-red-500">{errors.password}</p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
              className="peer sr-only"
            />

            <span className="flex h-4 w-4 items-center justify-center border border-fashion-beige transition-colors peer-checked:border-fashion-primary peer-checked:bg-fashion-primary">
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="hidden h-3 w-3 text-white peer-checked:block"
              >
                <path
                  d="m2.5 6 2.2 2.2L9.5 3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span className="text-sm text-fashion-muted">
              Remember me
            </span>
          </label>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-6 flex h-14 w-full items-center justify-center gap-3 border border-fashion-beige bg-transparent px-6 text-xs font-medium uppercase tracking-[0.14em] text-fashion-dark transition-all duration-300 hover:border-fashion-primary hover:bg-fashion-beige/20"
        >
          {/* Google Icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M21.805 12.23c0-.79-.07-1.55-.2-2.28H12v4.31h5.49a4.69 4.69 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.05-4.4 3.05-7.67Z"
              fill="#4285F4"
            />

            <path
              d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.3-2.56c-.91.61-2.07.97-3.47.97-2.67 0-4.93-1.8-5.74-4.22H2.85v2.64A10.22 10.22 0 0 0 12 22Z"
              fill="#34A853"
            />

            <path
              d="M6.26 13.72A6.14 6.14 0 0 1 5.94 12c0-.6.11-1.18.32-1.72V7.64H2.85A10 10 0 0 0 1.78 12c0 1.57.38 3.05 1.07 4.36l3.41-2.64Z"
              fill="#FBBC05"
            />

            <path
              d="M12 6.06c1.5 0 2.85.52 3.91 1.54l2.93-2.93C17.07 2.99 14.76 2 12 2a10.22 10.22 0 0 0-9.15 5.64l3.41 2.64C7.07 7.86 9.33 6.06 12 6.06Z"
              fill="#EA4335"
            />
          </svg>

          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-fashion-beige" />

          <span className="text-[10px] uppercase tracking-[0.2em] text-fashion-muted">
            Or
          </span>

          <div className="h-px flex-1 bg-fashion-beige" />
        </div>

        {/* Login button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex h-14 w-full items-center justify-center bg-fashion-dark px-6 text-xs font-medium uppercase tracking-[0.18em] text-fashion-bg transition-all duration-300 hover:bg-fashion-brown disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? (
            <span className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border border-fashion-bg/30 border-t-fashion-bg" />
              Signing in
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* Register */}
      <div className="mt-8 flex items-center justify-center gap-2 text-sm">
        <span className="text-fashion-muted">
          Don't have an account?
        </span>

        <button
          type="button"
          onClick={() => {
            console.log("Create account clicked");
          }}
          className="font-medium text-fashion-primary underline underline-offset-4 transition-colors hover:text-fashion-brown"
        >
          Create account
        </button>
      </div>
    </div>
  );
}

export default LoginForm;