const navItems = [
  {
    label: "New In",
    path: "/",
  },
  {
    label: "Women",
    path: "/women",
  },
  {
    label: "Men",
    path: "/men",
  },
  {
    label: "Collections",
    path: "/collections",
  },
  {
    label: "Sale",
    path: "/sale",
  },
];

export default function NavbarNav({ onNavigate }) {
  return (
    <nav className="hidden items-center gap-8 lg:flex xl:gap-10">
      {navItems.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => onNavigate(item.path)}
          className="group relative py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
        >
          {item.label}

          <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
        </button>
      ))}
    </nav>
  );
}

export { navItems };