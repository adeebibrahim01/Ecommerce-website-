import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, Mail, Lock } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Use the same image that you are using on your Login page.
const heroImage =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=85";
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!formData.name || !formData.email || !formData.password) {
      setErrorMessage(
        "Please fill in all required fields (Name, Email, Password)."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "https://ecommerce-website.adeebibrahim01.workers.dev/auth/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create account.");
      }

      if (data.token || data.userId) {
        localStorage.setItem(
          "authToken",
          data.token || data.userId
        );
      }

      setSuccessMessage(
        "Account created successfully! Redirecting..."
      );

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error("Signup error:", err);

      setErrorMessage(
        err.message ||
          "Failed to create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eee9df]">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">

        {/* =====================================================
            LEFT SIDE — IMAGE / BRAND SECTION
        ====================================================== */}
        <div className="relative hidden min-h-screen w-1/2 overflow-hidden lg:block">

          {/* Background Image */}
         <img
  src={heroImage}
  alt="Aurelia fashion editorial"
  className="absolute inset-0 h-full w-full object-cover"
/>

          {/* Orange Overlay */}
          <div className="absolute inset-0 bg-[#c87547]/70 mix-blend-multiply" />

          {/* Soft Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#9f552f]/20 via-transparent to-[#5e2f1d]/30" />

          {/* Brand */}
          <div className="absolute left-9 top-8 z-10">
            <h2 className="font-serif text-[25px] tracking-[0.14em] text-white">
              AURELIA
            </h2>
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-9 left-9 z-10 max-w-[390px] text-white">

            <div className="mb-4 flex items-center gap-4">
              <span className="h-px w-12 bg-white/80" />

              <span className="text-[10px] font-medium tracking-[0.28em] uppercase">
                New Season · 2026
              </span>
            </div>

            <h1 className="font-serif text-[54px] font-medium leading-[0.91] tracking-[-0.025em]">
              Elegance
              <br />
              in every
              <br />
              detail.
            </h1>

            <div className="mt-7 flex items-center gap-4">
              <span className="h-px w-12 bg-white/80" />

              <span className="text-[10px] font-medium tracking-[0.25em] uppercase">
                Discover your style
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================
            MOBILE BRAND HEADER
        ====================================================== */}
        <div className="relative flex h-[190px] w-full overflow-hidden lg:hidden">

          <img
            src={heroImage}
            alt="Aurelia fashion"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-[#c87547]/70 mix-blend-multiply" />

          <div className="absolute left-6 top-6 z-10">
            <h2 className="font-serif text-[21px] tracking-[0.14em] text-white">
              AURELIA
            </h2>
          </div>

          <div className="absolute bottom-5 left-6 z-10">
            <p className="text-[8px] font-medium tracking-[0.25em] text-white uppercase">
              New Season · 2026
            </p>

            <h1 className="mt-2 font-serif text-[30px] leading-[0.95] text-white">
              Elegance in
              <br />
              every detail.
            </h1>
          </div>
        </div>

        {/* =====================================================
            RIGHT SIDE — SIGN UP FORM
        ====================================================== */}
        <div className="flex min-h-screen w-full items-center justify-center bg-[#eee9df] px-6 py-12 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">

          <div className="w-full max-w-[410px]">

            {/* Back Button */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="group mb-10 flex items-center gap-2 text-[9px] font-medium tracking-[0.2em] text-[#8b8177] uppercase transition-colors duration-300 hover:text-[#432817]"
            >
              <ArrowLeft
                size={13}
                strokeWidth={1.5}
                className="transition-transform duration-300 group-hover:-translate-x-1"
              />

              Back
            </button>

            {/* Heading */}
            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="h-px w-7 bg-[#8c8174]" />

                <span className="text-[9px] font-medium tracking-[0.28em] text-[#8c8174] uppercase">
                  Join Aurelia
                </span>
              </div>

              <h1 className="font-serif text-[48px] font-medium leading-none tracking-[-0.025em] text-[#432817] sm:text-[52px]">
                Create account
              </h1>

              <p className="mt-5 max-w-[380px] text-[11px] leading-6 tracking-[0.01em] text-[#81786f]">
                Enter your details to join a world of timeless fashion,
                curated collections, and effortless style.
              </p>
            </div>

            {/* Divider */}
            <div className="mt-9 h-px w-full bg-[#d5cec3]" />

            {/* =================================================
                FORM
            ================================================== */}
            <form
              onSubmit={handleSignup}
              className="mt-8 flex flex-col gap-5"
            >

              {/* Full Name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-[9px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
                >
                  Full Name *
                </label>

                <div className="relative">
                  <User
                    size={15}
                    strokeWidth={1.4}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8178]"
                  />

                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                    autoComplete="name"
                    className="h-[46px] w-full border border-[#cfc6ba] bg-[#f3efe7] pl-10 pr-4 text-[11px] text-[#432817] outline-none transition-all duration-300 placeholder:text-[#a39b92] focus:border-[#432817] focus:bg-[#f7f3ec]"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-[9px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
                >
                  Email Address *
                </label>

                <div className="relative">
                  <Mail
                    size={15}
                    strokeWidth={1.4}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8178]"
                  />

                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="h-[46px] w-full border border-[#cfc6ba] bg-[#f3efe7] pl-10 pr-4 text-[11px] text-[#432817] outline-none transition-all duration-300 placeholder:text-[#a39b92] focus:border-[#432817] focus:bg-[#f7f3ec]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-[9px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
                >
                  Password *
                </label>

                <div className="relative">
                  <Lock
                    size={15}
                    strokeWidth={1.4}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8178]"
                  />

                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="h-[46px] w-full border border-[#cfc6ba] bg-[#f3efe7] pl-10 pr-4 text-[11px] tracking-[0.08em] text-[#432817] outline-none transition-all duration-300 placeholder:text-[#a39b92] focus:border-[#432817] focus:bg-[#f7f3ec]"
                  />
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="border border-red-200 bg-red-50/60 px-4 py-3">
                  <p className="text-[10px] leading-5 tracking-wide text-red-600">
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <p className="text-[10px] leading-5 tracking-wide text-emerald-700">
                    {successMessage}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 h-[44px] w-full bg-[#432817] text-[9px] font-semibold tracking-[0.25em] text-[#eee9df] uppercase transition-all duration-300 hover:bg-[#5a3720] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            {/* =================================================
                SECURE ACCESS
            ================================================== */}
            <div className="mt-7 flex items-center gap-4">
              <span className="h-px flex-1 bg-[#d5cec3]" />

              <span className="text-[8px] font-medium tracking-[0.22em] text-[#958c82] uppercase">
                Secure access
              </span>

              <span className="h-px flex-1 bg-[#d5cec3]" />
            </div>

            <div className="mt-6 border border-[#d7d0c5] px-4 py-3.5">
              <p className="text-center text-[9px] leading-5 tracking-wide text-[#8a8178]">
                Your information is securely protected.
                <br />
                We never share your personal details.
              </p>
            </div>

            {/* Sign In */}
            <div className="mt-8 text-center">
              <p className="text-[10px] text-[#8b8177]">
                Already have an account?
              </p>

              <Link
                to="/login"
                className="mt-2 inline-block text-[9px] font-semibold tracking-[0.2em] text-[#432817] uppercase underline decoration-[#432817]/40 underline-offset-4 transition-colors duration-300 hover:text-[#6a4329]"
              >
                Sign in
              </Link>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center">
              <p className="text-[8px] font-medium tracking-[0.18em] text-[#958c82] uppercase">
                © 2026 Aurelia · All rights reserved
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}