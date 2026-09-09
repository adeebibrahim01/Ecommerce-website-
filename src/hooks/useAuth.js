import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "https://ecommerce-website.adeebibrahim01.workers.dev";

export function useAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token exists in URL search params
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");

    if (urlToken) {
      // 1. Save token in LocalStorage
      localStorage.setItem("auth_token", urlToken);

      // 2. Clear query string from URL without page reload
      window.history.replaceState({}, document.title, window.location.pathname);

      // 3. Navigate to protected Home route ('/')
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    navigate("/login", { replace: true });
  };

  return {
    loginWithGoogle,
    logout,
  };
}