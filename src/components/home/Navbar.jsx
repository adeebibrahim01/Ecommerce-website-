import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";

import NavbarNav from "./NavbarNav";
import NavbarActions from "./NavbarActions";
import MobileMenu from "./MobileMenu";

export default function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const { cartCount, cartItems } = useCart(user?.id);

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
          cartCount={cartCount}
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
          cartCount={cartCount}
          onNavigate={handleNavigation}
          logout={logout}
        />
      </div>
    </header>
  );
}