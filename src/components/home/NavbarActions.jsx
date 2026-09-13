import UserMenu from "./UserMenu";
import CartPreview from "./CartPreview";
import WishlistPreview from "../shop/WishlistPreview";
import NavbarSearch from "./NavbarSearch";

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
  wishlistAddingMap = {}, // BUG FIX: defaulted so a missing/forgotten prop from a parent never sends `undefined` down to WishlistPreview's `isAdding`
}) {
  return (
    <div className="hidden items-center gap-1 rounded-full border border-[#D1B79E]/50 bg-white/30 py-1 pr-1 pl-2 sm:flex">
      {/* Search — trigger button + full-width search overlay is included
          inside NavbarSearch itself. cartItems/wishlistItems isliye pass
          kiye hain taake result cards par "In Cart" / "Wishlisted" label
          dikh sakay */}
      <NavbarSearch
        onNavigate={onNavigate}
        cartItems={cartItems}
        wishlistItems={wishlistItems}
      />

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