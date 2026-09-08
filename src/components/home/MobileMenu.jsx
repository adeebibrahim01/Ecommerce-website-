import {
  ShoppingBag,
  Menu,
  X,
  UserRound,
  LogOut,
} from "lucide-react";

import { navItems } from "./NavbarNav";

export default function MobileMenu({
  user,
  userName,
  userImage,
  mobileMenu,
  setMobileMenu,
  userMenu,
  setUserMenu,
  cartCount,
  onNavigate,
  logout,
}) {
  return (
    <>
      {/* Mobile actions */}

      <div className="flex items-center gap-2 sm:hidden">
        {/* Bag */}

        <button
          type="button"
          aria-label="Shopping bag"
          onClick={() => onNavigate("/cart")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817]"
        >
          <ShoppingBag
            size={18}
            strokeWidth={1.35}
          />

          <span className="absolute top-0 right-0 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] text-white">
            {cartCount}
          </span>
        </button>

        {/* User avatar */}

        {user && (
          <button
            type="button"
            onClick={() =>
              setUserMenu(!userMenu)
            }
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
                  event.currentTarget.style.display =
                    "none";
                }}
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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D1B79E]/70 bg-white/20 text-[#432817]"
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
      </div>

      {/* ================================
          MOBILE MENU
      ================================= */}

      <div
        className={`absolute top-[76px] right-0 left-0 grid transition-[grid-template-rows] duration-300 sm:hidden ${
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
                      event.currentTarget.style.display =
                        "none";
                    }}
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