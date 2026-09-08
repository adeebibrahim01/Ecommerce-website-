// src/hooks/useAuth.js

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function useAuth() {
  const navigate = useNavigate();

  // =========================================================
  // INITIAL USER
  // =========================================================
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return null;
    }

    try {
      const userData = JSON.parse(savedUser);

      if (!userData || !userData.email) {
        localStorage.removeItem("user");
        return null;
      }

      return userData;
    } catch (error) {
      console.error("Failed to read saved user:", error);

      localStorage.removeItem("user");

      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // SYNC AUTH STATE
  // =========================================================
  useEffect(() => {
    const syncAuth = () => {
      const savedUser = localStorage.getItem("user");

      if (!savedUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const userData = JSON.parse(savedUser);

        if (userData && userData.email) {
          setUser(userData);
        } else {
          localStorage.removeItem("user");
          setUser(null);
        }
      } catch (error) {
        console.error("Failed to parse saved user:", error);

        localStorage.removeItem("user");
        setUser(null);
      }

      setIsLoading(false);
    };

    // Initial sync
    syncAuth();

    // Custom event:
    // LoginSuccess.jsx dispatches this after successful login.
    window.addEventListener("auth-change", syncAuth);

    // Native event:
    // Useful when localStorage changes from another browser tab.
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("auth-change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  // =========================================================
  // GOOGLE LOGIN
  // =========================================================
  const loginWithGoogle = () => {
    window.location.href =
      "https://ecommerce-website.adeebibrahim01.workers.dev/auth/google";
  };

  // =========================================================
  // LOGOUT
  // =========================================================
  const logout = () => {
    localStorage.removeItem("user");

    setUser(null);

    window.dispatchEvent(new Event("auth-change"));

    navigate("/login", {
      replace: true,
    });
  };

  // =========================================================
  // RETURN AUTH DATA
  // =========================================================
  return {
    user,
    isLoading,
    loginWithGoogle,
    logout,
  };
}