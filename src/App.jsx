import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/home/Navbar";
import Footer from "./components/home/Footer";

import LoginForm from "./components/auth/LoginForm";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./hooks/useAuth"; // Auth hook import kiya agar user id chahiye ho
import OrderSuccess from "./pages/OrderSuccess";
import Home from "./pages/Home";
import Men from "./pages/Men";
import Women from "./pages/Women";
import CartPage from "./pages/cartpage";
import ProductDetail from "./pages/ProductDetail"; // Aapka detail page component
import LoginSuccess from "./pages/LoginSuccess";
import Signup from "./pages/Signup";
<Route path="/order-success" element={<OrderSuccess />} />
import VerifyEmail from "./pages/VerifyEmail";
import AdminRoute from "./components/auth/AdminRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
function MainLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function App() {
  const { user } = useAuth();
  const userId = user?.id || user?._id || user?.sub || user?.email;

  return (
    <Routes>
      {/* ==================== MAIN WEBSITE ==================== */}

      {/* Home */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Home userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Men */}
      <Route
        path="/men"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Men userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Women */}
      <Route
        path="/women"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Women userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Cart Page */}
      <Route
        path="/cart"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CartPage userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== AUTH ==================== */}

      {/* Login - NO Navbar / Footer */}
      <Route path="/login" element={<LoginForm />} />

      {/* Google Auth Redirect Handler - NO Navbar / Footer */}
      <Route path="/login-success" element={<LoginSuccess />} />


      {/* ==================== 404 ==================== */}

      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Signup />} /> {/* 👈 Yahan Signup route add karein */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      // ... baki routes ke sath yeh add karein:
      <Route
        path="/product/:id"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ProductDetail userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      // routes ke andar:
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

export default App;