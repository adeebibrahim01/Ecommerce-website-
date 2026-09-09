import { UserRound, LogOut, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function UserMenu({
  user,
  userName,
  userImage,
  userMenu,
  setUserMenu,
  onNavigate,
  logout,
}) {
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef(null);

  // Check token to ensure fallback authentication check
  const token = localStorage.getItem("auth_token");
  const isAuthenticated = Boolean(user || token);

  // Fallbacks: Direct props ya user object se values retrieve karein
  const displayName = userName || user?.name || "Aurelia Member";
  const displayImage = userImage || user?.picture || user?.avatar;
  const displayEmail = user?.email || "";

  // Dropdown menu ko bahar click karne par close karne ka handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (setUserMenu) setUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setUserMenu]);

  // Logout Trigger Function
  const handleLogout = () => {
    if (setUserMenu) setUserMenu(false);
    if (typeof logout === "function") {
      logout();
    } else {
      localStorage.removeItem("auth_token");
      if (onNavigate) onNavigate("/login");
      else window.location.href = "/login";
    }
  };

  // Unauthenticated State (Sign In Button)
  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => onNavigate && onNavigate("/login")}
        className="rounded-full bg-[#432817] px-5 py-2.5 text-[9px] font-semibold tracking-[0.16em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setUserMenu && setUserMenu(!userMenu)}
        className="group flex items-center gap-2.5 rounded-full border border-[#D1B79E]/70 bg-white/25 py-1.5 pr-3 pl-1.5 transition-all duration-300 hover:bg-white/45"
      >
        {/* User Avatar / Fallback Icon */}
        {displayImage && !imgError ? (
          <img
            src={displayImage}
            alt={displayName}
            className="h-8 w-8 rounded-full object-cover ring-1 ring-[#C9B39D]/60"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#432817] text-white">
            <UserRound size={14} strokeWidth={1.5} />
          </span>
        )}

        {/* User Name */}
        <span className="max-w-[100px] truncate text-left text-[9px] font-semibold tracking-[0.08em] text-[#432817]">
          {displayName}
        </span>

        {/* Dropdown Arrow */}
        <ChevronDown
          size={12}
          className={`ml-0.5 text-[#977150] transition-transform duration-300 ${
            userMenu ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* User Dropdown Menu */}
      {userMenu && (
        <div className="absolute top-[calc(100%+12px)] right-0 z-50 w-56 overflow-hidden rounded-2xl border border-[#D1B79E]/70 bg-[#F4EEE5]/95 p-2 shadow-[0_18px_50px_rgba(67,40,23,0.12)] backdrop-blur-xl">
          <div className="border-b border-[#D1B79E]/50 px-3 py-3">
            <p className="truncate text-[10px] font-semibold tracking-[0.08em] text-[#432817]">
              {displayName}
            </p>

            {displayEmail && (
              <p className="mt-0.5 truncate text-[9px] text-[#8A8177]">
                {displayEmail}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[9px] font-semibold tracking-[0.12em] text-[#432817] uppercase transition-colors hover:bg-[#EDE6DA]"
          >
            <LogOut size={14} strokeWidth={1.4} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}