import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/home/Navbar";
import Footer from "./components/home/Footer";

import LoginForm from "./components/auth/LoginForm";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import OrderSuccess from "./pages/OrderSuccess";
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import CartPage from "./pages/cartpage";
import ProductDetail from "./pages/ProductDetail";
import LoginSuccess from "./pages/LoginSuccess";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/Verifyemail";
import AdminRoute from "./components/auth/AdminRoute";
import AdminDashboard from "./pages/admin/Admindashboard";
import AdminLogin from "./pages/AdminLogin";
import BrandProducts from "./pages/BrandProducts";
import BrandsIndex from "./pages/BrandsIndex";
import WishlistPage from "./pages/WishlistPage";
import DealsPage from "./components/shop/Dealspage";
import DealDetailPage from "./components/shop/DealDetailPage";
import MyOrders from "./pages/MyOrders";
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

      <Route
        path="/men"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage category="men" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/women"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage category="women" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

<Route
  path="/my-orders"
  element={
    <ProtectedRoute>
      <MainLayout>
        <MyOrders />
      </MainLayout>
    </ProtectedRoute>
  }
/>
<Route
  path="/my-orders/:orderId"
  element={
    <ProtectedRoute>
      <MainLayout>
        <MyOrders />
      </MainLayout>
    </ProtectedRoute>
  }
/>

      <Route
        path="/Accessories"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage category="Accessories" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== COLLECTIONS ==================== */}

      {/* New In — backend collection=new-in filter (p.is_new_in = 1) */}
      <Route
        path="/new-in"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage collection="new-in" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Sale — backend collection=sale filter (p.is_on_sale = 1) */}
      <Route
        path="/sale"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage collection="sale" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Deals — deals worker (GET /deals), discounts across products/categories/brands */}
      {/* BUG FIX: this route used to sit bare at the bottom of the file with
          no ProtectedRoute and no MainLayout — it rendered with no Navbar,
          no Footer, and bypassed the auth guard every other page has. Moved
          up next to its closest sibling (/sale) and wrapped to match. */}
      <Route
        path="/deals"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DealsPage userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/deals/:id"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DealDetailPage userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      {/* New Arrivals — backend collection=new-in filter */}
      <Route
        path="/new-arrivals"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage collection="new-in" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Best Sellers — backend collection=bestseller filter */}
      <Route
        path="/bestsellers"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage collection="bestseller" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Featured — backend collection=featured filter */}
      <Route
        path="/featured"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage collection="featured" userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== SEARCH ==================== */}

      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CategoryPage userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== CART ==================== */}

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

      {/* ==================== PRODUCT ==================== */}

      <Route
        path="/product/:slug"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ProductDetail userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== BRANDS ==================== */}

      {/* Brands — general listing */}
      <Route
        path="/brands"
        element={
          <ProtectedRoute>
            <MainLayout>
              <BrandsIndex />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Brands — specific brand products */}
      <Route
        path="/brands/:slug"
        element={
          <ProtectedRoute>
            <MainLayout>
              <BrandProducts userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== ORDER ==================== */}

      <Route path="/order-success" element={<OrderSuccess />} />

      {/* ==================== AUTH (CUSTOMER) ==================== */}

      <Route path="/login" element={<LoginForm />} />
      <Route path="/login-success" element={<LoginSuccess />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* ==================== ADMIN ==================== */}

      <Route path="/admin-login" element={<AdminLogin />} />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />

      {/* ==================== WISHLIST ==================== */}

      <Route
        path="/wishlist"
        element={
          <ProtectedRoute>
            <MainLayout>
              <WishlistPage userId={userId} />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ==================== 404 ==================== */}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;