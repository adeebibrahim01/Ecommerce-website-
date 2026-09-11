import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "https://ecommerce-website.adeebibrahim01.workers.dev";
const MINIMUM_LOADER_DELAY = 1200;

// Where each role lands right after a successful login/signup/verification.
const ROLE_HOME_PATH = {
  admin: "/admin",
  user: "/",
};

function getRoleHomePath(role) {
  return ROLE_HOME_PATH[role] || "/";
}

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
    const params = new URLSearchParams(window.location.search);
    const hasUrlToken = params.has("token");
    const hasSavedToken = Boolean(localStorage.getItem("auth_token"));
    return hasUrlToken || hasSavedToken;
  });

  const navigate = useNavigate();

  const persistSession = useCallback((token, userData) => {
    if (token) localStorage.setItem("auth_token", token);
    localStorage.setItem("user_info", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setUser(null);
  }, []);

  /** The ONE place that decides where a user lands after any successful auth event. */
  const redirectAfterAuth = useCallback(
    (userData) => {
      navigate(getRoleHomePath(userData?.role), { replace: true });
    },
    [navigate]
  );

  const fetchUserProfile = useCallback(
    async (token) => {
      const startTime = Date.now();
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        const elapsed = Date.now() - startTime;
        await new Promise((r) => setTimeout(r, Math.max(0, MINIMUM_LOADER_DELAY - elapsed)));

        if (response.ok && data.authenticated && data.user) {
          persistSession(token, data.user);
          return data.user;
        }
        clearSession();
        return null;
      } catch (err) {
        console.error("Error fetching user profile:", err);
        clearSession();
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [clearSession, persistSession]
  );

  useEffect(() => {
    const handleAuthFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");

      // CASE 1: Redirected back from Google OAuth with a token in the URL.
      if (urlToken) {
        window.history.replaceState(null, "", window.location.pathname);
        const profile = await fetchUserProfile(urlToken);
        if (profile) redirectAfterAuth(profile);
        return;
      }

      // CASE 2: Returning visitor with a saved session.
      const savedToken = localStorage.getItem("auth_token");
      if (savedToken) {
        await fetchUserProfile(savedToken);
      } else {
        setIsLoading(false);
      }
    };

    handleAuthFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  /**
   * Email/password login. The backend issues a token immediately even if the
   * email isn't verified yet (verification just flips `is_verified: true`,
   * it doesn't gate access) — so we always persist + redirect on success.
   */
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        return { success: false, message: data.message || "Invalid email or password." };
      }

      persistSession(data.token, data.user);
      redirectAfterAuth(data.user);
      return { success: true, needsVerification: !data.user.is_verified };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        return { success: false, message: data.message || "Failed to create account." };
      }

      persistSession(data.token, data.user);
      redirectAfterAuth(data.user);
      return { success: true, needsVerification: !data.user.is_verified };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  /** Confirms the 6-digit code sent by /auth/signup or /auth/resend-verification. */
  const verifyEmail = async (code) => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, message: data.message || "Verification failed." };
      }
      // Refresh the cached user so is_verified flips to true everywhere.
      if (user) persistSession(token, { ...user, is_verified: true });
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const resendVerification = async () => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return { success: response.ok && data.success, message: data.message };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("auth_token");
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors on logout — clear local session regardless.
    }
    clearSession();
    navigate("/login", { replace: true });
  };

  const isAdmin = user?.role === "admin";

  return {
    user,
    isLoading,
    isAdmin,
    loginWithGoogle,
    login,
    signup,
    verifyEmail,
    resendVerification,
    logout,
  };
}