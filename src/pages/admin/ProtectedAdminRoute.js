// src/components/ProtectedAdminRoute.jsx
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";

export default function ProtectedAdminRoute({ children }) {
    const { admin, isLoading } = useAdminAuth();

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#EDE6DA] text-xs text-[#7E7E86]">
                Loading…
            </div>
        );
    }

    if (!admin) {
        return <Navigate to="/admin-login" replace />;
    }

    return children;
}