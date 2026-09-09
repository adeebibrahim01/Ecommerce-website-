import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "https://ecommerce-website.adeebibrahim01.workers.dev";
const MINIMUM_LOADER_DELAY = 2500; // 2.5 seconds minimum loader time

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user_info");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      localStorage.removeItem("user_info");
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(() => {
    const hasUrlToken = new URLSearchParams(window.location.search).has("token");
    const hasSavedToken = Boolean(localStorage.getItem("auth_token"));
    return hasUrlToken || hasSavedToken;
  });

  const navigate = useNavigate();

  // Profile fetcher function with enforced minimum delay
  const fetchUserProfile = useCallback(async (token) => {
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }

      const data = await response.json();

      const elapsedTime = Date.now() - startTime;
      const remainingDelay = Math.max(0, MINIMUM_LOADER_DELAY - elapsedTime);

      if (data.authenticated && data.user) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        setUser(data.user);
        localStorage.setItem("user_info", JSON.stringify(data.user));
        return true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_info");
        setUser(null);
        return false;
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      const elapsedTime = Date.now() - startTime;
      const remainingDelay = Math.max(0, MINIMUM_LOADER_DELAY - elapsedTime);
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));

      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_info");
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleAuthFlow = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get("token");

      // CASE 1: User OAuth Callback with token in URL
      if (urlToken) {
        localStorage.setItem("auth_token", urlToken);

        // Silent URL cleanup
        window.history.replaceState(null, "", window.location.pathname);

        const success = await fetchUserProfile(urlToken);
        if (success) {
          navigate("/", { replace: true });
        }
        return;
      }

      // CASE 2: Existing saved session check
      const savedToken = localStorage.getItem("auth_token");

      if (savedToken) {
        await fetchUserProfile(savedToken);
      } else {
        setIsLoading(false);
      }
    };

    handleAuthFlow();
  }, [fetchUserProfile, navigate]);

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  // Manual Login helper function for Login.jsx
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid email or password");
      }

      // Save token and user info
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.user));
      setUser(data.user);

      navigate("/", { replace: true });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setUser(null);
    navigate("/login", { replace: true });
  };

  return {
    user,
    isLoading,
    loginWithGoogle,
    login,
    logout,
  };
}