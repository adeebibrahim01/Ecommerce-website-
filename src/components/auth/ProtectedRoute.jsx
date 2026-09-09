import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  // Check if token exists in localStorage
  const token = localStorage.getItem("auth_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}