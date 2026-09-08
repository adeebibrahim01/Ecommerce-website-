import {
  Search,
  Heart,
} from "lucide-react";

import UserMenu from "./UserMenu";
import CartPreview from "./CartPreview";

export default function NavbarActions({
  user,
  userName,
  userImage,
  userMenu,
  setUserMenu,
  cartCount,
  cartItems,
  onNavigate,
  logout,
}) {
  return (
    <div className="hidden items-center gap-3 sm:flex">
      {/* Search */}

      <button
        type="button"
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
      >
        <Search
          size={17}
          strokeWidth={1.35}
        />
      </button>

      {/* Wishlist */}

      <button
        type="button"
        aria-label="Wishlist"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
      >
        <Heart
          size={17}
          strokeWidth={1.35}
        />
      </button>

      {/* Shopping Bag */}

      <CartPreview
        cartCount={cartCount}
        cartItems={cartItems}
        onNavigate={onNavigate}
      />

      {/* Divider */}

      <div className="mx-2 h-8 w-px bg-[#D1B79E]" />

      {/* User */}

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