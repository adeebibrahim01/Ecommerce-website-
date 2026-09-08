// src/pages/LoginSuccess.jsx

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLoginSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get("user");

      // No user data received
      if (!userParam) {
        console.error("Login successful, but user data is missing.");
        navigate("/login", { replace: true });
        return;
      }

      try {
        // Decode and parse user data received from Cloudflare Worker
        const userData = JSON.parse(userParam);

        // Validate required user information
        if (!userData || !userData.email) {
          console.error("Invalid user data received:", userData);
          navigate("/login", { replace: true });
          return;
        }

        // Normalize the user object coming from D1
        const normalizedUser = {
          id: userData.id || "",
          google_id: userData.google_id || "",
          name: userData.name || "",
          email: userData.email || "",
          profile_image: userData.profile_image || "",
          created_at: userData.created_at || "",
        };

        // Save the authenticated user locally
        localStorage.setItem(
          "user",
          JSON.stringify(normalizedUser)
        );

        // Notify useAuth and Navbar in the current tab
        window.dispatchEvent(new Event("auth-change"));

        // Remove user data from the browser URL
        window.history.replaceState(
          {},
          document.title,
          "/login-success"
        );

        // Redirect to home
        navigate("/", { replace: true });
      } catch (error) {
        console.error(
          "Error processing Google login user data:",
          error
        );

        localStorage.removeItem("user");

        window.dispatchEvent(new Event("auth-change"));

        navigate("/login", { replace: true });
      }
    };

    handleLoginSuccess();
  }, [navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#faf8f5]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-800 border-t-transparent" />

        <p className="text-sm font-medium text-stone-600">
          Signing in...
        </p>
      </div>
    </div>
  );
}