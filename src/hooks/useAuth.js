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

  const fetchUserProfile = useCallback(async (token) => {
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      const elapsedTime = Date.now() - startTime;
      const remainingDelay = Math.max(0, MINIMUM_LOADER_DELAY - elapsedTime);

      if (response.ok && data.authenticated && data.user) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        setUser(data.user);
        localStorage.setItem("user_info", JSON.stringify(data.user));

        // Session valid hai lekin email verify nahi hui — chahe user kahin
        // bhi ho (back button, direct URL, refresh), verify-email pe bhej do.
        if (!data.user.is_verified && window.location.pathname !== "/verify-email") {
          navigate("/verify-email", { replace: true });
        }

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
  }, [navigate]);

  useEffect(() => {
    const handleAuthFlow = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get("token");
      const oauthError = searchParams.get("error");

      if (oauthError) {
        window.history.replaceState(null, "", window.location.pathname);
        setIsLoading(false);
        return;
      }

      // CASE 1: Google OAuth callback with token in URL
      if (urlToken) {
        localStorage.setItem("auth_token", urlToken);
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

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.user));
      setUser(data.user);

      navigate(data.user.is_verified ? "/" : "/verify-email", { replace: true });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // New: Signup helper, mirrors login() — Signup.jsx can switch to this
  // instead of calling fetch directly, so token/user get stored consistently.
  const signup = async (name, email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create account.");
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.user));
      setUser(data.user);

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const verifyEmail = async (code) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid verification code.");
      }

      // Update local user copy so is_verified reflects immediately
      setUser((prev) => {
        const updated = prev ? { ...prev, is_verified: true } : prev;
        if (updated) localStorage.setItem("user_info", JSON.stringify(updated));
        return updated;
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const resendVerificationCode = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to resend code.");
      }

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
    signup,
    verifyEmail,
    resendVerificationCode,
    logout,
  };
}