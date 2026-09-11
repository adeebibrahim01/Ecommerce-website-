import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

/**
 * Wrap /admin/* routes with this.
 *
 * Flow:
 *  - Not logged in            -> /login
 *  - Logged in, role = 'user' -> "/" (their normal flow, never sees admin UI)
 *  - Logged in, role = 'admin'-> renders the Admin Portal
 *
 * The role itself always comes from the database (via /auth/me on the backend,
 * which reads the `role` column) — never trust a role stored only in the browser.
 */
export default function AdminRoute({ children }) {
    const { user, isLoading, isAdmin } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoading) return;

        if (!user) {
            navigate("/login", { replace: true });
            return;
        }

        if (!isAdmin) {
            // Logged-in but not an admin — quietly send them back to their normal experience.
            navigate("/", { replace: true });
        }
    }, [isLoading, user, isAdmin, navigate]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#EDE6DA] text-[#432817]">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#977150]" />
            </div>
        );
    }

    return isAdmin ? children : null;
}