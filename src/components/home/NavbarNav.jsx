import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";

// Sirf itne brands dropdown mein dikhengay — baqi "View all brands" se milengay.
const PREVIEW_BRAND_COUNT = 3;

const navItems = [
  {
    label: "New In",
    path: "/new-in",
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

  // Sirf preview ke liye top N brands — box ko chota aur ek row mein rakhta hai.
  const previewBrands = brands.slice(0, PREVIEW_BRAND_COUNT);

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
        <div className="absolute left-1/2 top-full z-40 w-56 -translate-x-1/2 rounded-2xl border border-[#D1B79E] bg-[#F5F2EC] p-3 shadow-[0_16px_40px_rgba(67,40,23,0.14)]">
          <p className="mb-2 px-1 text-[9px] font-semibold tracking-[0.2em] text-[#977150] uppercase">
            Shop by brand
          </p>

          {!loaded ? (
            // Skeleton rows — sirf PREVIEW_BRAND_COUNT items, taake asal
            // layout se koi jump na ho jab brands load hon.
            <div className="flex flex-col gap-1">
              {Array.from({ length: PREVIEW_BRAND_COUNT }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg p-1.5">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[#D1B79E]/40" />
                  <div className="h-2 w-20 animate-pulse rounded-full bg-[#D1B79E]/30" />
                </div>
              ))}
            </div>
          ) : previewBrands.length === 0 ? (
            <p className="px-1 py-3 text-[10px] text-[#7E7E86]">No brands yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {previewBrands.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onNavigate(`/brands/${brand.slug}`);
                  }}
                  className="group flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-[#432817]/[0.05]"
                >
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="h-7 w-7 shrink-0 rounded-full border border-[#D1B79E]/60 bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D1B79E]/30 font-serif text-[11px] text-[#432817]">
                      {brand.name.charAt(0)}
                    </div>
                  )}
                  <span className="flex-1 truncate text-[9px] font-medium tracking-[0.06em] text-[#432817] uppercase transition-colors group-hover:text-[#977150]">
                    {brand.name}
                  </span>
                  {typeof brand.product_count === "number" && (
                    <span className="shrink-0 text-[9px] font-medium text-[#977150]">
                      {brand.product_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNavigate("/brands");
            }}
            className="mt-2 block w-full border-t border-[#D1B79E]/40 pt-2 text-center text-[9px] font-semibold tracking-[0.15em] text-[#977150] uppercase transition-colors hover:text-[#432817]"
          >
            View all brands →
          </button>
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