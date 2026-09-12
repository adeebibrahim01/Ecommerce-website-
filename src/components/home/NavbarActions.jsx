import { Search } from "lucide-react";

import UserMenu from "./UserMenu";
import CartPreview from "./CartPreview";
import WishlistPreview from "../shop/WishlistPreview";

export default function NavbarActions({
  user,
  userName,
  userImage,
  userMenu,
  setUserMenu,
  cartCount,
  cartItems,
  onRemoveItem,
  onNavigate,
  logout,
  wishlistCount,
  wishlistItems,
  onRemoveWishlistItem,
  onAddWishlistItemToCart,
  wishlistAddingMap,
}) {
  return (
    <div className="hidden items-center gap-1 rounded-full border border-[#D1B79E]/50 bg-white/30 py-1 pr-1 pl-2 sm:flex">
      {/* Search */}
      <button
        type="button"
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/60 hover:text-[#977150]"
      >
        <Search size={17} strokeWidth={1.35} />
      </button>

      {/* Wishlist — ab CartPreview jaisa hover dropdown */}
      <WishlistPreview
        wishlistCount={wishlistCount}
        wishlistItems={wishlistItems}
        onNavigate={onNavigate}
        onRemoveItem={onRemoveWishlistItem}
        onAddToCart={onAddWishlistItemToCart}
        isAdding={wishlistAddingMap}
      />

      {/* Shopping Bag */}
      <CartPreview
        cartCount={cartCount}
        cartItems={cartItems}
        onRemoveItem={onRemoveItem}
        onNavigate={onNavigate}
      />

      <div className="mx-1 h-6 w-px bg-[#D1B79E]" />

      <UserMenu
        user={user}
        userName={userName}
        userImage={userImage}
        userMenu={userMenu}
        setUserMenu={setUserMenu}
        onNavigate={onNavigate}
        logout={logout}
      />
    </div>
  );
}