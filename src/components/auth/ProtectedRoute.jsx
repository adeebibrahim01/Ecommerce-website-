import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

/** Wrap any route that just requires "logged in" — user or admin, doesn't matter. */
export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const isUserLoggedIn = !!user;

  useEffect(() => {
    if (!isLoading && !isUserLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isUserLoggedIn, navigate]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#EDE6DA] text-[#432817]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#977150]" />
      </div>
    );
  }

  return isUserLoggedIn ? children : null;
}