import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  X,
  UserRound,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

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

  // =========================================================
  // USER PROFILE IMAGE
  // =========================================================
  // D1 user:
  // profile_image
  //
  // Old/other auth formats are also supported:
  // photoURL / photo
  // =========================================================
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
        <nav className="hidden items-center gap-8 lg:flex xl:gap-10">
          <button
            type="button"
            onClick={() => handleNavigation("/")}
            className="group relative py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
          >
            New In
            <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
          </button>

          <button
            type="button"
            onClick={() => handleNavigation("/women")}
            className="group relative py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
          >
            Women
            <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
          </button>

          <button
            type="button"
            onClick={() => handleNavigation("/men")}
            className="group relative py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
          >
            Men
            <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
          </button>

          <button
            type="button"
            onClick={() => handleNavigation("/collections")}
            className="group relative py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
          >
            Collections
            <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
          </button>

          <button
            type="button"
            onClick={() => handleNavigation("/sale")}
            className="group relative py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
          >
            Sale
            <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
          </button>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 sm:flex">
          {/* Search */}
          <button
            type="button"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
          >
            <Search size={17} strokeWidth={1.35} />
          </button>

          {/* Wishlist */}
          <button
            type="button"
            aria-label="Wishlist"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
          >
            <Heart size={17} strokeWidth={1.35} />
          </button>

          {/* Shopping Bag */}
          <button
            type="button"
            aria-label="Shopping bag"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
          >
            <ShoppingBag size={17} strokeWidth={1.35} />

            <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] font-semibold text-white">
              0
            </span>
          </button>

          {/* Divider */}
          <div className="mx-2 h-8 w-px bg-[#D1B79E]" />

          {/* User */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenu(!userMenu)}
                className="group flex items-center gap-2.5 rounded-full border border-[#D1B79E]/70 bg-white/25 py-1.5 pr-3 pl-1.5 transition-all duration-300 hover:bg-white/45"
              >
                {/* Avatar */}
                {userImage ? (
                  <img
                    src={userImage}
                    alt={userName}
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-[#C9B39D]/60"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#432817] text-white">
                    <UserRound size={14} strokeWidth={1.5} />
                  </span>
                )}

                {/* Name */}
                <span className="max-w-[100px] truncate text-left text-[9px] font-semibold tracking-[0.08em] text-[#432817]">
                  {userName}
                </span>

                <span
                  className={`ml-1 text-[9px] text-[#977150] transition-transform duration-300 ${
                    userMenu ? "rotate-180" : ""
                  }`}
                >
                  ⌄
                </span>
              </button>

              {/* User dropdown */}
              {userMenu && (
                <div className="absolute top-[calc(100%+12px)] right-0 w-56 overflow-hidden rounded-2xl border border-[#D1B79E]/70 bg-[#F4EEE5]/95 p-2 shadow-[0_18px_50px_rgba(67,40,23,0.12)] backdrop-blur-xl">
                  <div className="border-b border-[#D1B79E]/50 px-3 py-3">
                    <p className="truncate text-[10px] font-semibold tracking-[0.08em] text-[#432817]">
                      {userName}
                    </p>

                    {user?.email && (
                      <p className="mt-1 truncate text-[9px] text-[#8A8177]">
                        {user.email}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={logout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[9px] font-semibold tracking-[0.12em] text-[#432817] uppercase transition-colors hover:bg-[#EDE6DA]"
                  >
                    <LogOut size={14} strokeWidth={1.4} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleNavigation("/login")}
              className="rounded-full bg-[#432817] px-5 py-2.5 text-[9px] font-semibold tracking-[0.16em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* Bag */}
          <button
            type="button"
            aria-label="Shopping bag"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817]"
          >
            <ShoppingBag size={18} strokeWidth={1.35} />

            <span className="absolute top-0 right-0 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] text-white">
              0
            </span>
          </button>

          {/* User avatar */}
          {user && (
            <button
              type="button"
              onClick={() => setUserMenu(!userMenu)}
              aria-label="Account"
              className="overflow-hidden rounded-full border border-[#C9B39D] p-0.5"
            >
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName}
                  className="h-8 w-8 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#432817] text-white">
                  <UserRound size={14} strokeWidth={1.5} />
                </span>
              )}
            </button>
          )}

          {/* Menu */}
          <button
            type="button"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D1B79E]/70 bg-white/20 text-[#432817]"
          >
            {mobileMenu ? (
              <X size={19} strokeWidth={1.4} />
            ) : (
              <Menu size={19} strokeWidth={1.4} />
            )}
          </button>
        </div>
      </div>

      {/* ================================
          MOBILE MENU
      ================================= */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 sm:hidden ${
          mobileMenu
            ? "grid-rows-[1fr] border-t border-[#D1B79E]/50"
            : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-[#EDE6DA] px-5 py-7">
            {/* Mobile user card */}
            {user && (
              <div className="mb-7 flex items-center gap-3 rounded-2xl border border-[#D1B79E]/60 bg-white/25 p-3">
                {userImage ? (
                  <img
                    src={userImage}
                    alt={userName}
                    className="h-11 w-11 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#432817] text-white">
                    <UserRound size={17} strokeWidth={1.4} />
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
              <button
                type="button"
                onClick={() => handleNavigation("/")}
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                New In
                <span className="text-[#977150]">↗</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigation("/women")}
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                Women
                <span className="text-[#977150]">↗</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigation("/men")}
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                Men
                <span className="text-[#977150]">↗</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigation("/collections")}
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                Collections
                <span className="text-[#977150]">↗</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigation("/sale")}
                className="flex items-center justify-between border-b border-[#D1B79E]/45 py-4 text-left text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase"
              >
                Sale
                <span className="text-[#977150]">↗</span>
              </button>
            </nav>

            {/* Mobile actions */}
            {user ? (
              <button
                type="button"
                onClick={logout}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-[#432817] py-3 text-[9px] font-semibold tracking-[0.18em] text-[#432817] uppercase transition-colors hover:bg-[#432817] hover:text-white"
              >
                <LogOut size={14} strokeWidth={1.4} />
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNavigation("/login")}
                className="mt-6 w-full rounded-full bg-[#432817] py-3.5 text-[9px] font-semibold tracking-[0.18em] text-white uppercase"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}