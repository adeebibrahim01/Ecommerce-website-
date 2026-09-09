import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";

import NavbarNav from "./NavbarNav";
import NavbarActions from "./NavbarActions";
import MobileMenu from "./MobileMenu";

// Aapka live cart worker URL
const CART_COUNT_API_URL = "https://cart-worker-service.adeebibrahim01.workers.dev/cart/count";

export default function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [liveCartCount, setLiveCartCount] = useState(0);

  const navigate = useNavigate();

  const { user, logout } = useAuth();

  // Robust User ID resolution
  const activeUserId = user?.id || user?._id || user?.sub || user?.email;

  const { cartCount: hookCartCount, cartItems } = useCart(activeUserId);

  // Live cart count fetch karne ke liye worker call
useEffect(() => {
    const fetchCartCount = async () => {
      if (!activeUserId) {
        setLiveCartCount(0);
        return;
      }

      try {
        const targetUrl = `${CART_COUNT_API_URL}?userId=${encodeURIComponent(activeUserId)}`;
        const response = await fetch(targetUrl);
        
        // Pehle text me response lein taaki crash na ho
        const rawText = await response.text();
        
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          console.error("Server returned non-JSON response:", rawText);
          return;
        }

        if (data.success) {
          setLiveCartCount(Number(data.count) || 0);
        }
      } catch (error) {
        console.error("Failed to fetch cart count error:", error);
      }
    };

    fetchCartCount();

    const handleCartChange = () => {
      fetchCartCount();
    };

    window.addEventListener("cart-change", handleCartChange);
    return () => {
      window.removeEventListener("cart-change", handleCartChange);
    };
  }, [activeUserId]);
  // Fallback to hook count if live count is 0 or fallback mechanism
  const finalCartCount = liveCartCount > 0 ? liveCartCount : (hookCartCount || 0);

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenu(false);
    setUserMenu(false);
  };

  const userName =
    user?.displayName ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "Account";

  const userImage =
    user?.profile_image ||
    user?.photoURL ||
    user?.photo ||
    "";

  return (
    <header className="sticky top-0 z-50 border-b border-[#D1B79E]/50 bg-[#EDE6DA]/95 shadow-[0_4px_30px_rgba(67,40,23,0.04)] backdrop-blur-xl">
      {/* ================================
          DESKTOP / MAIN HEADER
      ================================= */}

      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-12 xl:px-16">
        {/* Logo */}

        <button
          type="button"
          onClick={() => handleNavigation("/")}
          className="group shrink-0"
        >
          <div className="flex flex-col">
            <span className="font-serif text-[22px] tracking-[0.16em] text-[#432817] transition-transform duration-300 group-hover:tracking-[0.2em]">
              AURELIA
            </span>

            <span className="mt-0.5 text-[6px] font-semibold tracking-[0.42em] text-[#977150] uppercase">
              Modern Essentials
            </span>
          </div>
        </button>

        {/* Desktop Navigation */}

        <NavbarNav onNavigate={handleNavigation} />

        {/* Desktop Actions */}

        <NavbarActions
          user={user}
          userName={userName}
          userImage={userImage}
          userMenu={userMenu}
          setUserMenu={setUserMenu}
          cartCount={finalCartCount}
          cartItems={cartItems}
          onNavigate={handleNavigation}
          logout={logout}
        />

        {/* Mobile actions */}

        <MobileMenu
          user={user}
          userName={userName}
          userImage={userImage}
          mobileMenu={mobileMenu}
          setMobileMenu={setMobileMenu}
          userMenu={userMenu}
          setUserMenu={setUserMenu}
          cartCount={finalCartCount}
          onNavigate={handleNavigation}
          logout={logout}
        />
      </div>
    </header>
  );
}