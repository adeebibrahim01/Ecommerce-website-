import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../hooks/useWishlist";

import NavbarNav from "./NavbarNav";
import NavbarActions from "./NavbarActions";
import MobileMenu from "./MobileMenu";

// ==========================================
// SCROLL-AWARE HEADER STATE
// A storefront header at this level responds to three
// things as the person scrolls:
//  - scrolled: past the very top, so it should compact
//    and pick up a stronger shadow/opacity
//  - hidden: the person is scrolling DOWN past the
//    header's own height, so it tucks away to give the
//    page more room; it reappears immediately on any
//    upward scroll, and always shows again near the top
//  - progress: how far through the page they are, driving
//    a thin indicator line under the header
// Every read is batched into a single requestAnimationFrame
// tick so this never fights the browser's own scrolling.
// ==========================================

const COMPACT_THRESHOLD = 24;
const HIDE_THRESHOLD = 140;

function useHeaderScroll() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handle = () => {
      const y = window.scrollY;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;

      setScrolled(y > COMPACT_THRESHOLD);
      setProgress(max > 0 ? Math.min(100, (y / max) * 100) : 0);

      const goingDown = y > lastY.current;
      if (y < HIDE_THRESHOLD) {
        setHidden(false);
      } else {
        setHidden(goingDown);
      }
      lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(handle);
        ticking.current = true;
      }
    };

    handle();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { scrolled, hidden, progress };
}

export default function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  // BUG FIX (missing prop wiring): NavbarActions -> WishlistPreview expects
  // a `wishlistAddingMap` (passed through as `isAdding`) so it can show a
  // per-item loading state while "Add to Cart" is in flight from the
  // wishlist dropdown. This never existed before, so the prop always
  // arrived as undefined. Tracked here as a simple { [productId]: true }
  // map — set before the mutation starts, cleared in `finally` regardless
  // of success or failure.
  const [wishlistAddingMap, setWishlistAddingMap] = useState({});

  const { scrolled, hidden, progress } = useHeaderScroll();

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const activeUserId = user ? (user.id || user._id || user.sub || user.email) : null;

  const { cartCount, cartItems, addToCart, removeFromCart } = useCart(activeUserId);
  const { wishlistCount, wishlistItems, removeFromWishlist } = useWishlist(activeUserId);

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenu(false);
    setUserMenu(false);
  };

  // Wishlist dropdown ke "Add to Cart" button ke liye —
  // cart mein daalo aur wishlist se turant hata do
  const handleAddWishlistItemToCart = async (item) => {
    setWishlistAddingMap((prev) => ({ ...prev, [item.id]: true }));
    try {
      // BUG FIX: addToCart() returns `false` on failure (it never throws —
      // see useCart.js), but this used to call removeFromWishlist()
      // unconditionally right after. That meant a failed "add to cart"
      // (network error, server down, etc.) still silently deleted the item
      // from the wishlist — permanent data loss with nothing actually
      // added to the cart. Now the wishlist item is only removed once the
      // cart add has actually succeeded.
      const addedToCart = await addToCart(item.id, 1, {
        name: item.name,
        price: item.sale_price ?? item.price,
        image: item.image,
        dealId: item.deal_id ?? null,
        dealName: item.deal_name ?? null,
        originalPrice: item.original_price ?? null,
      });
      if (addedToCart) {
        await removeFromWishlist(item.id, item.deal_id);
      }
    } finally {
      setWishlistAddingMap((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
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

  // Ek dropdown (user menu ya mobile menu) khula ho to header ko
  // hide-on-scroll se exempt rakhte hain — warna scroll hote hi menu
  // apne trigger ke sath ghayab ho jata.
  const isTuckedAway = hidden && !mobileMenu && !userMenu;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ease-out ${scrolled
          ? "border-[#D1B79E]/60 bg-[#F5F2EC]/95 shadow-[0_8px_30px_rgba(67,40,23,0.08)]"
          : "border-[#D1B79E]/50 bg-[#F5F2EC]/90 shadow-[0_4px_30px_rgba(67,40,23,0.05)]"
        } ${isTuckedAway ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div
        className="mx-auto flex max-w-[1600px] items-center justify-between px-5 transition-[height] duration-300 ease-out sm:px-8 lg:px-12 xl:px-16"
        style={{ height: scrolled ? "60px" : "76px" }}
      >
        <button
          type="button"
          onClick={() => handleNavigation("/")}
          className="group shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#977150]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2EC]"
        >
          <div className="flex flex-col">
            <span
              className="font-serif tracking-[0.16em] text-[#432817] transition-all duration-300 group-hover:tracking-[0.2em]"
              style={{ fontSize: scrolled ? "18px" : "22px" }}
            >
              AURELIA
            </span>
            <span
              className={`mt-0.5 overflow-hidden font-semibold tracking-[0.42em] text-[#977150] uppercase transition-all duration-300 ${scrolled ? "max-h-0 opacity-0" : "max-h-3 opacity-100"
                }`}
              style={{ fontSize: "6px" }}
            >
              Modern Essentials
            </span>
          </div>
        </button>

        <NavbarNav onNavigate={handleNavigation} />

        <NavbarActions
          user={user}
          userName={userName}
          userImage={userImage}
          userMenu={userMenu}
          setUserMenu={setUserMenu}
          cartCount={cartCount}
          cartItems={cartItems}
          onRemoveItem={removeFromCart}
          onNavigate={handleNavigation}
          logout={logout}
          wishlistCount={wishlistCount}
          wishlistItems={wishlistItems}
          onRemoveWishlistItem={removeFromWishlist}
          onAddWishlistItemToCart={handleAddWishlistItemToCart}
          wishlistAddingMap={wishlistAddingMap}
        />

        <MobileMenu
          user={user}
          userName={userName}
          userImage={userImage}
          mobileMenu={mobileMenu}
          setMobileMenu={setMobileMenu}
          userMenu={userMenu}
          setUserMenu={setUserMenu}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          onNavigate={handleNavigation}
          logout={logout}
        />
      </div>

      {/* Scroll progress — a thin, page-wide indicator of how far through
          the storefront the person has scrolled. Only visible once
          scrolling has actually started, so it never sits as dead
          decoration on first paint. */}
      <div
        className="h-[2px] bg-[#A9714F] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, opacity: scrolled ? 1 : 0 }}
      />
    </header>
  );
}