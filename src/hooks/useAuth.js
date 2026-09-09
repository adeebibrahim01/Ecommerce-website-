// src/hooks/useAuth.js

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function useAuth() {
  const navigate = useNavigate();

  console.log("========================================");
  console.log("[useAuth] Hook initialized");
  console.log("[useAuth] Current URL:", window.location.href);
  console.log("[useAuth] Current pathname:", window.location.pathname);
  console.log("[useAuth] Current search:", window.location.search);
  console.log("========================================");

  // =========================================================
  // INITIAL USER
  // =========================================================
  const [user, setUser] = useState(() => {
    console.log("[useAuth] INITIAL USER: Checking localStorage...");

    const savedUser = localStorage.getItem("user");

    console.log("[useAuth] INITIAL USER: localStorage value:", savedUser);

    if (!savedUser) {
      console.log("[useAuth] INITIAL USER: No saved user found.");
      return null;
    }

    try {
      const userData = JSON.parse(savedUser);

      console.log("[useAuth] INITIAL USER: Parsed user:", userData);

      if (!userData || !userData.email) {
        console.warn(
          "[useAuth] INITIAL USER: Invalid user data. Removing localStorage user."
        );
        localStorage.removeItem("user");
        return null;
      }

      console.log("[useAuth] INITIAL USER: Valid user found:", {
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });

      return userData;
    } catch (error) {
      console.error(
        "[useAuth] INITIAL USER: Failed to read saved user:",
        error
      );
      localStorage.removeItem("user");
      console.log("[useAuth] INITIAL USER: Invalid localStorage removed.");
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  console.log("[useAuth] Current React state:", {
    user,
    isLoading,
  });

  // =========================================================
  // SYNC AUTH STATE
  // =========================================================
  useEffect(() => {
    console.log("----------------------------------------");
    console.log("[useAuth] SYNC EFFECT: useEffect started");
    console.log("[useAuth] SYNC EFFECT: Current URL:", window.location.href);
    console.log("----------------------------------------");

    // src/hooks/useAuth.js ke syncAuth() function mein yeh logic add karein:

    const syncAuth = () => {
      console.log("[useAuth] SYNC AUTH Running...");
      const searchParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = searchParams.get("token"); // ya 'user' parameter

      if (tokenFromUrl) {
        console.log("[useAuth] Found Token in URL parameters!", tokenFromUrl);

        // User data construct / Decode Token
        const userObj = { token: tokenFromUrl };
        localStorage.setItem("user", JSON.stringify(userObj));

        // Clean URL parameters without page refresh
        window.history.replaceState({}, document.title, window.location.pathname);

        setUser(userObj);
        setIsLoading(false);
        return;
      }

      // Fallback to LocalStorage
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    // Initial sync
    console.log("[useAuth] SYNC EFFECT: Running initial syncAuth()...");
    syncAuth();

    // Custom event: LoginSuccess.jsx dispatches this after successful login.
    console.log("[useAuth] SYNC EFFECT: Adding auth-change listener.");
    window.addEventListener("auth-change", syncAuth);

    // Native event: Useful when localStorage changes from another browser tab.
    console.log("[useAuth] SYNC EFFECT: Adding storage listener.");
    window.addEventListener("storage", syncAuth);

    return () => {
      console.log("[useAuth] SYNC EFFECT: Cleanup - removing listeners.");
      window.removeEventListener("auth-change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  // =========================================================
  // GOOGLE LOGIN (DYNAMIC ORIGIN UPDATE)
  // =========================================================
  const loginWithGoogle = () => {
    console.log("========================================");
    console.log("[useAuth] GOOGLE LOGIN: Function called");
    console.log("[useAuth] GOOGLE LOGIN: Current URL:", window.location.href);
    console.log(
      "[useAuth] GOOGLE LOGIN: Current origin:",
      window.location.origin
    );

    // DYNAMIC URL: Uses current domain (localhost:5173 or workers.dev)
    const googleAuthUrl = `${window.location.origin}/auth/google`;

    console.log("[useAuth] GOOGLE LOGIN: Redirect URL:", googleAuthUrl);
    console.log("[useAuth] GOOGLE LOGIN: Redirecting browser now...");
    console.log("========================================");

    window.location.href = googleAuthUrl;
  };

  // =========================================================
  // LOGOUT
  // =========================================================
  const logout = () => {
    console.log("========================================");
    console.log("[useAuth] LOGOUT: Function called");
    console.log("[useAuth] LOGOUT: Current user before logout:", user);
    console.log("[useAuth] LOGOUT: Removing localStorage user.");

    localStorage.removeItem("user");
    setUser(null);

    console.log("[useAuth] LOGOUT: React user state set to null.");
    console.log("[useAuth] LOGOUT: Dispatching auth-change event.");

    window.dispatchEvent(new Event("auth-change"));

    console.log("[useAuth] LOGOUT: Navigating to /login");

    navigate("/login", {
      replace: true,
    });

    console.log("========================================");
  };

  // =========================================================
  // RETURN AUTH DATA
  // =========================================================
  console.log("[useAuth] RETURN:", {
    user,
    isLoading,
    hasLoginWithGoogle: typeof loginWithGoogle === "function",
    hasLogout: typeof logout === "function",
  });

  return {
    user,
    isLoading,
    loginWithGoogle,
    logout,
  };
}