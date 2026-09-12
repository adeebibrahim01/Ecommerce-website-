import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, ChevronDown, RotateCcw } from "lucide-react";

import ProductCard from "../components/shop/ProductCard";
import ProductFilters from "../components/shop/ProductFilters";
import ProductSort from "../components/shop/ProductSort";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";

// Ye grid sirf Men's page ke liye hai — is liye `category` prop nahi
// leta (pehle wale version mein parent se "men" pass hota tha, jo
// galti se kabhi bhi "women" ya kuch aur bhi ho sakta tha). Ab
// `CATEGORY` hamesha fixed "men" hai, is liye is component se kabhi
// bhi women ya koi aur category ka data load nahi ho sakta.
const CATEGORY = "men";

const API_BASE =
  import.meta.env.VITE_PRODUCT_API_URL || "https://product-worker-service.adeebibrahim01.workers.dev";

// Worker ka /products endpoint max limit=50 per page allow karta hai,
// is liye agar men's category mein 50 se zyada products hon to hum
// pagination loop laga kar sab pages khींch lete hain.
async function fetchAllMenProducts(signal) {
  const all = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      category: CATEGORY,
    });

    const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
      signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to load products (status ${res.status})`);
    }

    const data = await res.json();
    if (!data?.success) {
      throw new Error(data?.message || "Failed to load products.");
    }

    all.push(...(data.products || []));

    const total = data.total || 0;
    if (all.length >= total || (data.products || []).length < limit) {
      break;
    }
    page += 1;
  }

  return all;
}

// Worker se aane wala row snake_case mein hai (filter_category, sale_price
// wagera), lekin UI (ProductFilters/ProductSort/ProductCard) camelCase
// expect karti hai. Yahan normalize kar rahe hain taake neeche ka baqi
// code bilkul same rahe.
function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.sale_price ?? row.price,
    image: row.image,
    category: row.category,
    filterCategory: row.filter_category,
    type: row.type,
    badge: row.badge,
    featured: row.featured,
    createdAt: row.created_at,
  };
}

const SKELETON_COUNT = 8;

// ─────────────────────────────────────────────────────────────
// Shimmer skeleton block — Facebook-style: soft base tone + ek
// diagonal light band jo loop mein guzarta hai. Reduced-motion
// walon ke liye plain static tone (no animation).
// ─────────────────────────────────────────────────────────────

function ShimmerBlock({ className = "" }) {
  return <div className={`aurelia-shimmer ${className}`} />;
}

function ProductCardSkeleton() {
  return (
    <div>
      <ShimmerBlock className="aspect-[3/4] w-full overflow-hidden" />
      <div className="pt-4">
        <ShimmerBlock className="mb-3 h-2.5 w-14 rounded-full" />
        <div className="flex items-start justify-between gap-4">
          <ShimmerBlock className="h-3 w-28 rounded-full" />
          <ShimmerBlock className="h-3 w-10 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function MenProductGrid({ userId: userIdProp }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const { user } = useAuth();
  const userId = userIdProp || user?.id;

  const { cartItems, addToCart, isLoading: isCartLoading } = useCart(userId);

  // Database se men's products laana hai — sirf mount pe aur jab
  // "Try again" se dobara koshish ho (`reloadToken`), kyunke `category`
  // ab fixed hai, prop se nahi aata. Baqi filtering (selectedCategory)
  // aur sorting client side hoti hai taake UI turant respond kare.
  //
  // FIX (race condition): agar effect jaldi jaldi dobara chale (retry
  // click ya remount), to purani (abort ho chuki) request ka
  // `.then/.catch/.finally` bhi chal sakta hai, kyunke `abort()` sirf
  // fetch ki promise reject karta hai, `.finally` ko rokta nahi. Is liye
  // local `cancelled` flag rakha hai — cleanup mein `true` hota hai, aur
  // har state-update se pehle check hota hai, taake stale request kabhi
  // bhi latest UI ko overwrite na kare.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoadingProducts(true);
    setLoadError("");

    fetchAllMenProducts(controller.signal)
      .then((rows) => {
        if (cancelled) return;
        setProducts(rows.map(normalizeProduct));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.name === "AbortError") return;
        console.error("Men product fetch error:", err);
        setLoadError(err.message || "Failed to load products.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingProducts(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  const handleAddToCart = async (product) => {
    if (!userId) {
      alert("Please log in to add items to cart.");
      return;
    }
    if (!product?.id) return;

    const success = await addToCart(product.id, 1, {
      name: product.name,
      price: product.price,
      image: product.image,
    });

    if (success) {
      // Toast notification or success indicator added here
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    // `products` yahan already sirf men's category ka data hai (API
    // call khud "category=men" bhejti hai), is liye neeche sirf
    // product `type` (shirts/jackets/etc.) pe filter lagta hai — koi
    // women/accessories wala data is list mein aata hi nahi.
    let result = [...products];

    if (selectedCategory !== "All") {
      result = result.filter(
        (product) =>
          product.filterCategory?.toLowerCase() ===
          selectedCategory.toLowerCase()
      );
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        break;

      case "price-low":
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;

      case "price-high":
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;

      case "name":
        result.sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        );
        break;

      case "featured":
      default:
        result.sort(
          (a, b) =>
            Number(b.featured || 0) - Number(a.featured || 0)
        );
        break;
    }

    return result;
  }, [products, selectedCategory, sortBy]);

  const isProductInCart = (productId) => {
    if (!cartItems) return false;
    return cartItems.some(
      (item) => String(item.product_id || item.productId) === String(productId)
    );
  };

  return (
    <section className="relative overflow-hidden bg-[#EDE6DA]">
      <style>{`
        @keyframes aurelia-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .aurelia-grid-item {
          animation: aurelia-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--aurelia-delay, 0ms);
        }

        @keyframes aurelia-shimmer-sweep {
          0% { background-position: -300% 0; }
          100% { background-position: 300% 0; }
        }
        .aurelia-shimmer {
          background-color: rgba(209, 183, 158, 0.28);
          background-image: linear-gradient(
            100deg,
            rgba(209, 183, 158, 0.28) 30%,
            rgba(255, 255, 255, 0.65) 50%,
            rgba(209, 183, 158, 0.28) 70%
          );
          background-size: 300% 100%;
          animation: aurelia-shimmer-sweep 1.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurelia-grid-item { animation: none; }
          .aurelia-shimmer { animation: none; background-image: none; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/25 to-transparent" />

      <div className="relative border-y border-[#D8CFC2]/80 bg-[#EDE6DA]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex min-h-[76px] items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#CFC4B5] bg-white/30">
                  <SlidersHorizontal
                    size={15}
                    strokeWidth={1.5}
                    className="text-[#432817]"
                  />
                </div>

                <span className="text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase">
                  Filter
                </span>
              </div>

              <div className="hidden h-7 w-px bg-[#CFC4B5] sm:block" />

              <div className="min-w-0">
                <ProductFilters
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-3 md:flex">
              <span className="text-[10px] tracking-[0.16em] text-[#8A8177] uppercase">
                Men's Edit
              </span>

              {isLoadingProducts ? (
                <ShimmerBlock className="h-8 w-8 rounded-full" />
              ) : (
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[#CFC4B5] bg-white/35 px-2 text-[10px] font-semibold text-[#432817] shadow-[inset_0_1px_2px_rgba(67,40,23,0.06)]">
                  {filteredAndSortedProducts.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex min-h-[68px] items-center justify-between gap-4 border-b border-[#D8CFC2]/60">
            <div className="flex items-center gap-2">
              {isLoadingProducts ? (
                <ShimmerBlock className="h-3 w-16 rounded-full" />
              ) : (
                <>
                  <span className="text-[11px] font-medium text-[#432817]">
                    {filteredAndSortedProducts.length}
                  </span>

                  <span className="text-[10px] tracking-[0.12em] text-[#8A8177] uppercase">
                    {filteredAndSortedProducts.length === 1 ? "piece" : "pieces"}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] tracking-[0.14em] text-[#8A8177] uppercase sm:block">
                Sort by
              </span>

              <div className="relative">
                <ProductSort
                  value={sortBy}
                  onChange={setSortBy}
                  productCount={filteredAndSortedProducts.length}
                />

                <ChevronDown
                  size={13}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[#432817] sm:block"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16 xl:px-16">
        {isLoadingProducts ? (
          <>
            <div className="mb-9 flex items-end justify-between gap-6 lg:mb-12">
              <div>
                <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                  Curated for him
                </p>
                <ShimmerBlock className="h-9 w-56 rounded-md sm:h-10" />
              </div>
              <div className="hidden h-px flex-1 bg-[#D8CFC2] sm:block" />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : loadError ? (
          <div className="flex min-h-[460px] items-center justify-center">
            <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#D8CFC2] bg-white/25 px-6 py-16 text-center shadow-[0_20px_60px_rgba(67,40,23,0.04)] backdrop-blur-sm sm:px-12">
              <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-[#EDE6DA]">
                <RotateCcw size={20} strokeWidth={1.3} className="text-[#432817]" />
              </div>

              <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                Something went wrong
              </p>

              <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                Couldn't load the men's collection
              </h3>

              <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">
                {loadError}
              </p>

              <button
                type="button"
                onClick={() => setReloadToken((n) => n + 1)}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-[#432817] bg-[#432817] px-7 py-3 text-[9px] font-semibold tracking-[0.18em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
              >
                <RotateCcw size={12} strokeWidth={1.8} />
                Try again
              </button>
            </div>
          </div>
        ) : filteredAndSortedProducts.length > 0 ? (
          <>
            <div className="mb-9 flex items-end justify-between gap-6 lg:mb-12">
              <div>
                <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                  Curated for him
                </p>

                <h2 className="font-serif text-3xl leading-none tracking-[-0.02em] text-[#432817] sm:text-4xl lg:text-[2.75rem]">
                  {selectedCategory === "All"
                    ? "Men's Collection"
                    : selectedCategory}
                </h2>
              </div>

              <div className="hidden h-px flex-1 bg-gradient-to-r from-[#D8CFC2] to-transparent sm:block" />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
              {filteredAndSortedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="aurelia-grid-item group min-w-0"
                  style={{ "--aurelia-delay": `${Math.min(index * 45, 360)}ms` }}
                >
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    category={product.type}
                    badge={product.badge}
                    isInCart={isProductInCart(product.id)}
                    onAddToCart={() => handleAddToCart(product)}
                    isCartLoading={isCartLoading}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[460px] items-center justify-center">
            <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#D8CFC2] bg-white/25 px-6 py-16 text-center shadow-[0_20px_60px_rgba(67,40,23,0.04)] backdrop-blur-sm sm:px-12">
              <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-[#EDE6DA]">
                <SlidersHorizontal
                  size={20}
                  strokeWidth={1.3}
                  className="text-[#432817]"
                />
              </div>

              <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                Nothing here yet
              </p>

              <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                No men's pieces found
              </h3>

              <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">
                We couldn't find any products in the men's
                collection matching your selected filter. Try
                exploring another category.
              </p>

              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                className="mt-8 inline-flex items-center justify-center rounded-full border border-[#432817] bg-[#432817] px-7 py-3 text-[9px] font-semibold tracking-[0.18em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
              >
                View all men's pieces
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}