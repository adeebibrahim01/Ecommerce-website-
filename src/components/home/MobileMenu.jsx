import { useState } from "react";
import {
  ShoppingBag,
  Menu,
  X,
  UserRound,
  LogOut,
  Heart,
} from "lucide-react";
import { navItems } from "./NavbarNav";
import NavbarSearch from "./NavbarSearch";
export default function MobileMenu({
  user,
  userName,
  userImage,
  mobileMenu,
  setMobileMenu,
  userMenu,
  setUserMenu,
  cartCount,
  wishlistCount = 0, // default kiya — abhi Navbar.jsx ye prop pass nahi karta (neeche note dekhein)
  onNavigate,
  logout,
}) {
  // BUG FIX: avatar image load fail hone par pehle sirf `display:none` laga
  // diya jata tha — peeche koi fallback icon nahi tha, bas khaali circle reh
  // jata tha. Ab UserMenu.jsx wala hi pattern: error state track karo, fail
  // hone par fallback UserRound icon dikhao.
  const [avatarError, setAvatarError] = useState(false);
  const showAvatarImage = Boolean(userImage) && !avatarError;

  // BUG FIX (main issue): mobile bar mein search ka koi entry point hi
  // nahi tha — NavbarSearch sirf desktop NavbarActions ke andar (sm:flex)
  // render hota tha. Ab yahan bhi add kiya. Jab search khulti hai (pill
  // expand hoti hai), baaki icons temporarily chhupa dete hain taake
  // expand hone ke liye jagah mile aur row overflow na ho.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 sm:hidden">
        {/* Search — jab expand ho to baaki icons hide ho jate hain */}
        <NavbarSearch onNavigate={onNavigate} onOpenChange={setMobileSearchOpen} />

        {!mobileSearchOpen && (
          <>
            {/* Wishlist */}
            <button
              type="button"
              aria-label="Wishlist"
              onClick={() => onNavigate("/wishlist")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-colors hover:bg-white/40"
            >
              <Heart size={18} strokeWidth={1.35} />
              {wishlistCount > 0 && (
                <span className="absolute top-0 right-0 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] text-white">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Bag */}
            <button
              type="button"
              aria-label="Shopping bag"
              onClick={() => onNavigate("/cart")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-colors hover:bg-white/40"
            >
              <ShoppingBag size={18} strokeWidth={1.35} />
              {/* BUG FIX: this badge used to render unconditionally, showing "0"
              when the cart was empty — inconsistent with the wishlist badge
              right next to it, which already hides at 0. Now matches. */}
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* User avatar */}

            {user && (
              <button
                type="button"
                // BUG FIX: this used to call setUserMenu(!userMenu), but no
                // dropdown for `userMenu` was ever rendered anywhere in this
                // file — tapping the avatar visibly did nothing. The full
                // account drawer (user card + logout) already exists below via
                // `mobileMenu`, so tapping the avatar now opens that instead of
                // toggling dead state.
                onClick={() => setMobileMenu(true)}
                aria-label="Account"
                className="overflow-hidden rounded-full border border-[#C9B39D] p-0.5"
              >
                {showAvatarImage ? (
                  <img
                    src={userImage}
                    alt={userName}
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#432817] text-white">
                    <UserRound
                      size={14}
                      strokeWidth={1.5}
                    />
                  </span>
                )}
              </button>
            )}

            {/* Menu */}

            <button
              type="button"
              onClick={() =>
                setMobileMenu(!mobileMenu)
              }
              aria-label="Toggle menu"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D1B79E]/70 bg-white/20 text-[#432817] transition-colors hover:bg-white/40"
            >
              {mobileMenu ? (
                <X
                  size={19}
                  strokeWidth={1.4}
                />
              ) : (
                <Menu
                  size={19}
                  strokeWidth={1.4}
                />
              )}
            </button>
          </>
        )}
      </div>

      {/* ================================
          MOBILE MENU
      ================================= */}

      <div
        className={`absolute top-[76px] right-0 left-0 grid transition-[grid-template-rows] duration-300 sm:hidden ${mobileMenu
          ? "grid-rows-[1fr] border-t border-[#D1B79E]/50"
          : "grid-rows-[0fr]"
          }`}
      >
        <div className="overflow-hidden">
          {/* Panel bg aligned to the navbar's #F5F2EC theme (previously #EDE6DA) */}
          <div className="bg-[#F5F2EC] px-5 py-7">
            {/* Mobile user card */}

            {user && (
              <div className="mb-7 flex items-center gap-3 rounded-2xl border border-[#D1B79E]/60 bg-white/25 p-3">
                {showAvatarImage ? (
                  <img
                    src={userImage}
                    alt={userName}
                    className="h-11 w-11 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#432817] text-white">
                    <UserRound
                      size={17}
                      strokeWidth={1.4}
                    />
                  </span>
                )}

                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold tracking-[0.08em] text-[#432817]">
                    {userName}
                  </p>

                  {user?.email && (
                    <p className="mt-1 truncate text-[9px] text-[#8A8177]">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Mobile navigation */}

            <nav className="flex flex-col">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() =>
                    onNavigate(item.path)
                  }
                  className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
                >
                  {item.label}

                  <span className="text-[#977150]">
                    ↗
                  </span>
                </button>
              ))}

              {/* MISSING FEATURE ADDED: desktop nav has a "Brands" entry
                  (NavbarNav's BrandsDropdown), mobile had no way to reach
                  it at all. Links straight to /brands, same as desktop's
                  "View all brands" fallback. */}
              <button
                type="button"
                onClick={() => onNavigate("/brands")}
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                Brands
                <span className="text-[#977150]">↗</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate("/cart")
                }
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                Shopping Bag

                <span className="flex items-center gap-2 text-[#977150]">
                  <span>
                    {cartCount}
                  </span>

                  <span>↗</span>
                </span>
              </button>
            </nav>

            {/* Mobile actions */}

            {user ? (
              <button
                type="button"
                onClick={logout}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-[#432817] py-3 text-[9px] font-semibold tracking-[0.18em] text-[#432817] uppercase transition-colors hover:bg-[#432817] hover:text-white"
              >
                <LogOut
                  size={14}
                  strokeWidth={1.4}
                />

                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onNavigate("/login")
                }
                className="mt-6 w-full rounded-full bg-[#432817] py-3.5 text-[9px] font-semibold tracking-[0.18em] text-white uppercase"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}