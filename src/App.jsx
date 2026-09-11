import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/home/Navbar";
import Footer from "./components/home/Footer";

import LoginForm from "./components/auth/LoginForm";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import OrderSuccess from "./pages/OrderSuccess";
import Home from "./pages/Home";
import Men from "./pages/Men";
import Women from "./pages/Women";
import CartPage from "./pages/cartpage";
import ProductDetail from "./pages/ProductDetail";
import LoginSuccess from "./pages/LoginSuccess";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import AdminRoute from "./components/auth/AdminRoute";
import AdminDashboard from "./pages/admin/Admindashboard";
import AdminLogin from "./pages/AdminLogin";

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

      {/* Product Detail */}
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

      {/* Order success */}
      <Route path="/order-success" element={<OrderSuccess />} />

      {/* ==================== AUTH (customer) ==================== */}

      <Route path="/login" element={<LoginForm />} />
      <Route path="/login-success" element={<LoginSuccess />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* ==================== ADMIN (bilkul alag, apna worker/token) ==================== */}

      <Route path="/admin-login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />

      {/* ==================== 404 ==================== */}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;