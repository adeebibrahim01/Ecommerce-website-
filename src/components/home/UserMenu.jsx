import {
  UserRound,
  LogOut,
} from "lucide-react";

export default function UserMenu({
  user,
  userName,
  userImage,
  userMenu,
  setUserMenu,
  onNavigate,
  logout,
}) {
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => onNavigate("/login")}
        className="rounded-full bg-[#432817] px-5 py-2.5 text-[9px] font-semibold tracking-[0.16em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
      >
        Sign in
      </button>
    );
  }

  return (
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

        {/* Name */}

        <span className="max-w-[100px] truncate text-left text-[9px] font-semibold tracking-[0.08em] text-[#432817]">
          {userName}
        </span>

        <span
          className={`ml-1 text-[9px] text-[#977150] transition-transform duration-300 ${
            userMenu
              ? "rotate-180"
              : ""
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
            <LogOut
              size={14}
              strokeWidth={1.4}
            />

            Logout
          </button>
        </div>
      )}
    </div>
  );
}