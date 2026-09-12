import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";

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

function BrandsDropdown({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);
  const closeTimer = useRef(null);

  const loadBrands = async () => {
    if (loaded) return;
    try {
      const res = await fetch(`${API_BASE_URL}/brands`);
      const data = await res.json();
      if (data.success) setBrands(data.brands || []);
    } catch (err) {
      console.error("Could not load brands:", err);
    } finally {
      setLoaded(true);
    }
  };

  const handleEnter = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
    loadBrands();
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={() => onNavigate("/brands")}
        className="group relative flex items-center gap-1 py-2 text-[10px] font-semibold tracking-[0.18em] text-[#432817] uppercase"
      >
        Brands
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-[#432817] transition-transform duration-300 group-hover:scale-x-100" />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-40 w-56 -translate-x-1/2 border border-[#D1B79E] bg-[#EDE6DA] py-2 shadow-[0_10px_30px_rgba(67,40,23,0.12)]">
          {!loaded ? (
            <p className="px-4 py-2 text-[10px] text-[#7E7E86]">Loading…</p>
          ) : brands.length === 0 ? (
            <p className="px-4 py-2 text-[10px] text-[#7E7E86]">No brands yet.</p>
          ) : (
            brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigate(`/brands/${brand.slug}`);
                }}
                className="block w-full px-4 py-2 text-left text-[10px] tracking-[0.1em] text-[#432817] uppercase hover:bg-[#432817]/[0.05]"
              >
                {brand.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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

      <BrandsDropdown onNavigate={onNavigate} />
    </nav>
  );
}

export { navItems };