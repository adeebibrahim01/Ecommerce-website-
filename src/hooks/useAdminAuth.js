import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_API_BASE_URL = "https://aurelia-admin-worker.adeebibrahim01.workers.dev";

export function useAdminAuth() {
    const [admin, setAdmin] = useState(() => {
        try {
            const saved = localStorage.getItem("admin_info");
            return saved ? JSON.parse(saved) : null;
        } catch {
            localStorage.removeItem("admin_info");
            return null;
        }
    });
    const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem("admin_auth_token")));
    const navigate = useNavigate();

    const persistSession = useCallback((token, adminData) => {
        if (token) localStorage.setItem("admin_auth_token", token);
        localStorage.setItem("admin_info", JSON.stringify(adminData));
        setAdmin(adminData);
    }, []);

    const clearSession = useCallback(() => {
        localStorage.removeItem("admin_auth_token");
        localStorage.removeItem("admin_info");
        setAdmin(null);
    }, []);

    useEffect(() => {
        const verifySession = async () => {
            const token = localStorage.getItem("admin_auth_token");
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}/admin/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (response.ok && data.authenticated && data.admin) {
                    persistSession(token, data.admin);
                } else {
                    clearSession();
                }
            } catch (err) {
                console.error("Admin session check failed:", err);
                clearSession();
            } finally {
                setIsLoading(false);
            }
        };
        verifySession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (email, password) => {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}/admin/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                return { success: false, message: data.message || "Invalid email or password." };
            }

            persistSession(data.token, data.admin);
            navigate("/admin", { replace: true });
            return { success: true };
        } catch (err) {
            return { success: false, message: err.message };
        }
    };

    const logout = async () => {
        const token = localStorage.getItem("admin_auth_token");
        try {
            await fetch(`${ADMIN_API_BASE_URL}/admin/auth/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {
            // Ignore network errors on logout
        }
        clearSession();
        navigate("/admin-login", { replace: true });
    };

    return { admin, isLoading, login, logout };
}