import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../hooks/useWishlist";

import NavbarNav from "./NavbarNav";
import NavbarActions from "./NavbarActions";
import MobileMenu from "./MobileMenu";

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
      });
      if (addedToCart) {
        await removeFromWishlist(item.id);
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

  return (
    <header className="sticky top-0 z-50 border-b border-[#D1B79E]/50 bg-[#F5F2EC]/90 shadow-[0_4px_30px_rgba(67,40,23,0.05)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-12 xl:px-16">
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
    </header>
  );
}