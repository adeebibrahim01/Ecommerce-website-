import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/home/Navbar";
import Footer from "./components/home/Footer";

import LoginForm from "./components/auth/LoginForm";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import Home from "./pages/Home";
import Men from "./pages/Men";
import Women from "./pages/Women";
import LoginSuccess from "./pages/LoginSuccess";

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
  return (
    <Routes>
      {/* ==================== MAIN WEBSITE ==================== */}

      {/* Home */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Home />
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
              <Men />
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
              <Women />
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
    </Routes>
  );
}

export default App;