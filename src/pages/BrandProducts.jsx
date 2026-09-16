import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

import ProductCard from "../components/shop/ProductCard";
import ProductSort from "../components/shop/ProductSort";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";

const API_BASE =
    import.meta.env.VITE_PRODUCT_API_URL || "https://product-worker-service.adeebibrahim01.workers.dev";

// ProductGrid.jsx jaisa hi pagination-safe fetch — bas `brand` param
// use karta hai `category` ki jagah.
async function fetchAllProductsByBrand(brandSlug, signal) {
    const all = [];
    let page = 1;
    const limit = 50;

    while (true) {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            brand: brandSlug,
        });

        const res = await fetch(`${API_BASE}/products?${params.toString()}`, { signal });

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

// Worker ka row snake_case mein hai, UI (ProductCard/ProductSort)
// camelCase expect karti hai — ProductGrid.jsx jaisa hi normalize.
function normalizeProduct(row) {
    return {
        id: row.id,
        name: row.name,
        price: row.sale_price ?? row.price,
        image: row.image,
        category: row.category_name,
        filterCategory: row.filter_category,
        type: row.type,
        badge: row.badge,
        featured: row.featured,
        createdAt: row.created_at,
        brandName: row.brand_name,
    };
}

const SKELETON_COUNT = 8;

// ─────────────────────────────────────────────────────────────
// Shimmer skeleton block — same Facebook-style sweep as ProductGrid.jsx,
// so loading states feel identical across the whole app.
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

export default function BrandProducts({ userId: userIdProp }) {
    const { slug } = useParams();
    const [sortBy, setSortBy] = useState("featured");

    const [products, setProducts] = useState([]);
    const [brandName, setBrandName] = useState("");
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [reloadToken, setReloadToken] = useState(0);

    const { user } = useAuth();
    const userId = userIdProp || user?.id;

    const { cartItems, addToCart, isLoading: isCartLoading } = useCart(userId);

    useEffect(() => {
        const controller = new AbortController();
        // `controller.signal.aborted` akela kaafi nahi — jab yeh effect
        // StrictMode (dev) mein double-run hota hai ya `slug` jaldi jaldi
        // badalta hai, pehli (abort ho chuki) request ka `.finally` bhi
        // chal jata hai aur `isLoadingProducts` ko waqt se pehle false
        // kar deta hai (products abhi tak khaali hone ki wajah se "No
        // pieces found" ek pal ke liye flash ho jata). `cancelled` flag
        // har stale request ke result ko UI tak pohanchne se rok deta hai.
        let cancelled = false;

        setIsLoadingProducts(true);
        setLoadError("");

        fetchAllProductsByBrand(slug, controller.signal)
            .then((rows) => {
                if (cancelled) return;
                const normalized = rows.map(normalizeProduct);
                setProducts(normalized);
                if (normalized[0]?.brandName) setBrandName(normalized[0].brandName);
            })
            .catch((err) => {
                if (cancelled || err.name === "AbortError") return;
                console.error("Brand products fetch error:", err);
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
    }, [slug, reloadToken]);

    const handleAddToCart = async (product) => {
        if (!userId) {
            alert("Please log in to add items to cart.");
            return;
        }
        if (!product?.id) return;

        await addToCart(product.id, 1, {
            name: product.name,
            price: product.price,
            image: product.image,
        });
    };

    const sortedProducts = useMemo(() => {
        const result = [...products];

        switch (sortBy) {
            case "newest":
                result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                break;
            case "price-low":
                result.sort((a, b) => Number(a.price) - Number(b.price));
                break;
            case "price-high":
                result.sort((a, b) => Number(b.price) - Number(a.price));
                break;
            case "name":
                result.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                break;
            case "featured":
            default:
                result.sort((a, b) => Number(b.featured || 0) - Number(a.featured || 0));
                break;
        }

        return result;
    }, [products, sortBy]);

    const isProductInCart = (productId) => {
        if (!cartItems) return false;
        // Deal-only cart line shouldn't disable the plain add-to-cart button
        // here — only a normal (non-deal) line counts as already added.
        return cartItems.some(
            (item) =>
                String(item.product_id || item.productId) === String(productId) &&
                !(item.deal_id || item.dealId)
        );
    };

    const displayName = brandName || slug.replace(/-/g, " ");

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

            <div className="relative">
                <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12 xl:px-16">
                    <div className="flex min-h-[68px] items-center justify-between gap-4 border-b border-[#D8CFC2]/60">
                        <div className="flex items-center gap-2">
                            {isLoadingProducts ? (
                                <ShimmerBlock className="h-3 w-16 rounded-full" />
                            ) : (
                                <>
                                    <span className="text-[11px] font-medium text-[#432817]">
                                        {sortedProducts.length}
                                    </span>
                                    <span className="text-[10px] tracking-[0.12em] text-[#8A8177] uppercase">
                                        {sortedProducts.length === 1 ? "piece" : "pieces"}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="hidden text-[10px] tracking-[0.14em] text-[#8A8177] uppercase sm:block">
                                Sort by
                            </span>
                            <ProductSort value={sortBy} onChange={setSortBy} productCount={sortedProducts.length} />
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
                                    Brand
                                </p>
                                <ShimmerBlock className="h-9 w-56 rounded-md sm:h-10" />
                            </div>
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
                                Couldn't load products
                            </h3>
                            <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">{loadError}</p>
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
                ) : sortedProducts.length > 0 ? (
                    <>
                        <div className="mb-9 flex items-end justify-between gap-6 lg:mb-12">
                            <div>
                                <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                                    Brand
                                </p>
                                <h2 className="font-serif text-3xl leading-none tracking-[-0.02em] text-[#432817] capitalize sm:text-4xl lg:text-[2.75rem]">
                                    {displayName}
                                </h2>
                            </div>
                            <div className="hidden h-px flex-1 bg-gradient-to-r from-[#D8CFC2] to-transparent sm:block" />
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
                            {sortedProducts.map((product, index) => (
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
                                <SlidersHorizontal size={20} strokeWidth={1.3} className="text-[#432817]" />
                            </div>
                            <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                                Nothing here yet
                            </p>
                            <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                                No pieces found
                            </h3>
                            <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">
                                We couldn't find any products for this brand yet.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}