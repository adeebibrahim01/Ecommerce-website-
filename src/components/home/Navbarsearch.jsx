import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Search,
    X,
    Clock,
    ImageOff,
    ArrowRight,
    ShoppingBag,
    Heart,
    Store,
} from "lucide-react";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";
const RECENT_KEY = "aurelia_recent_searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 6;

function useDebouncedValue(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// Aapke asal /products endpoint ko use karta hai (?search= query param).
// Response shape: { success, products, total, page, limit }
async function defaultSearchProducts(query) {
    const res = await fetch(
        `${API_BASE_URL}/products?search=${encodeURIComponent(
            query
        )}&limit=${RESULTS_LIMIT}&sort=newest`
    );
    if (!res.ok) throw new Error("Search request failed");
    const data = await res.json();
    if (data && data.success === false) return [];
    return data.products || (Array.isArray(data) ? data : []);
}

// Cart/wishlist items ki field naming vary kar sakti hai (product_id vs
// id vs _id) — isliye ek hi jagah se safely product-id nikal lete hain.
function extractProductId(item) {
    if (!item) return null;
    const raw = item.product_id ?? item.id ?? item._id;
    return raw === undefined || raw === null ? null : String(raw);
}

function formatPrice(value) {
    if (value === null || value === undefined) return "";
    const num = Number(value);
    if (Number.isNaN(num)) return "";
    return `$${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function getRecentSearches() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveRecentSearch(term) {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
        const current = getRecentSearches().filter(
            (t) => t.toLowerCase() !== trimmed.toLowerCase()
        );
        localStorage.setItem(
            RECENT_KEY,
            JSON.stringify([trimmed, ...current].slice(0, MAX_RECENT))
        );
    } catch {
        // localStorage na ho to chup chaap ignore
    }
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[#D1B79E]/30" />
            <div className="flex-1">
                <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-[#D1B79E]/30" />
                <div className="mt-1.5 h-2 w-2/5 animate-pulse rounded-full bg-[#D1B79E]/20" />
            </div>
        </div>
    );
}

export default function NavbarSearch({
    onNavigate,
    searchProducts = defaultSearchProducts,
    resultsPath = "/search",
    cartItems = [],
    wishlistItems = [],
    onOpenChange, // optional — parent (e.g. mobile bar) can hide sibling icons while search is expanded
}) {
    const [open, setOpen] = useState(false);

    // Lets a parent react to open/close (e.g. MobileMenu hiding the other
    // icons so the expanding search pill has room). No-op on desktop where
    // no callback is passed — doesn't change existing behaviour there.
    useEffect(() => {
        onOpenChange?.(open);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [recent, setRecent] = useState([]);
    const [brands, setBrands] = useState([]);
    const [brandsLoaded, setBrandsLoaded] = useState(false);

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const requestIdRef = useRef(0);

    const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

    const cartIdSet = useMemo(
        () => new Set(cartItems.map(extractProductId).filter(Boolean)),
        [cartItems]
    );
    const wishlistIdSet = useMemo(
        () => new Set(wishlistItems.map(extractProductId).filter(Boolean)),
        [wishlistItems]
    );

    // Brands ek hi baar lazy-load hote hain (jab search pehli dafa khule) —
    // /brands endpoint search support nahi karta, isliye client-side hi
    // naam se match kar lete hain (BrandsDropdown wala hi pattern).
    useEffect(() => {
        if (!open || brandsLoaded) return;
        fetch(`${API_BASE_URL}/brands`)
            .then((res) => res.json())
            .then((data) => {
                if (data?.success) setBrands(data.brands || []);
            })
            .catch(() => { })
            .finally(() => setBrandsLoaded(true));
    }, [open, brandsLoaded]);

    const closeSearch = useCallback(() => {
        setOpen(false);
        setQuery("");
        setResults([]);
        setTotal(0);
        setActiveIndex(-1);
        setError(null);
    }, []);

    // Khulte hi focus + recent searches load
    useEffect(() => {
        if (open) {
            setRecent(getRecentSearches());
            const t = setTimeout(() => inputRef.current?.focus(), 200);
            return () => clearTimeout(t);
        }
    }, [open]);

    // Bahar click ya Escape par band karo
    useEffect(() => {
        if (!open) return;
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                closeSearch();
            }
        }
        function handleKey(e) {
            if (e.key === "Escape") closeSearch();
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open, closeSearch]);

    // Debounced fetch
    useEffect(() => {
        const trimmed = debouncedQuery.trim();
        if (!trimmed) {
            setResults([]);
            setTotal(0);
            setIsLoading(false);
            setError(null);
            return;
        }

        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);

        searchProducts(trimmed)
            .then((data) => {
                if (requestId !== requestIdRef.current) return;
                const list = Array.isArray(data) ? data : [];
                setResults(list);
                setTotal(list.length);
            })
            .catch(() => {
                if (requestId !== requestIdRef.current) return;
                setError("Kuch masla ho gaya, dobara koshish karein.");
                setResults([]);
            })
            .finally(() => {
                if (requestId !== requestIdRef.current) return;
                setIsLoading(false);
            });
    }, [debouncedQuery, searchProducts]);

    const goToProduct = useCallback(
        (product) => {
            saveRecentSearch(query || product.name);
            closeSearch();
            onNavigate(`/product/${product.id}`);
        },
        [query, onNavigate, closeSearch]
    );

    const goToAllResults = useCallback(
        (term) => {
            const trimmed = (term ?? query).trim();
            if (!trimmed) return;
            saveRecentSearch(trimmed);
            closeSearch();
            onNavigate(`${resultsPath}?q=${encodeURIComponent(trimmed)}`);
        },
        [query, onNavigate, resultsPath, closeSearch]
    );

    const handleKeyDown = (e) => {
        const len = results.length;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (len > 0) setActiveIndex((p) => (p + 1) % len);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (len > 0) setActiveIndex((p) => (p - 1 + len) % len);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && results[activeIndex]) {
                goToProduct(results[activeIndex]);
            } else {
                goToAllResults();
            }
        }
    };

    const handleIconClick = () => {
        if (!open) {
            setOpen(true);
            return;
        }
        if (query.trim()) {
            goToAllResults();
        } else {
            closeSearch();
        }
    };

    const trimmedQuery = query.trim();
    const showDropdown = open && (trimmedQuery || recent.length > 0);

    // Query se match hone wale brands (naam mein substring match) — max 4
    const matchingBrands = useMemo(() => {
        if (!trimmedQuery) return [];
        const q = trimmedQuery.toLowerCase();
        return brands.filter((b) => b.name?.toLowerCase().includes(q)).slice(0, 4);
    }, [brands, trimmedQuery]);

    return (
        <div ref={containerRef} className="relative flex items-center">
            {/* Ek hi unified pill — input aur icon dono isi ek border ke andar
          hain (bilkul outer navbar pill jaisa: #D1B79E border, white bg,
          poora rounded). Jab band ho to sirf icon dikhta hai bina border
          ke, khulte hi pura pill (input + icon) is border ke sath
          visible ho jata hai. */}
            <div
                className={`flex items-center overflow-hidden border transition-all duration-300 ease-out ${showDropdown ? "rounded-t-2xl" : "rounded-full"
                    } ${open
                        ? "w-[270px] border-[#D1B79E]/70 bg-white sm:w-[320px]"
                        : "w-9 border-transparent bg-transparent"
                    } ${open && !showDropdown ? "shadow-[0_2px_10px_rgba(67,40,23,0.06)]" : ""}`}
            >
                {open && (
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(-1);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search products..."
                        className="h-9 w-full min-w-0 bg-transparent pl-3.5 pr-1 text-[13px] text-[#432817] placeholder:text-[#977150]/55 outline-none"
                    />
                )}
                {open && query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            inputRef.current?.focus();
                        }}
                        className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#977150] transition-colors hover:bg-[#432817]/[0.06]"
                        aria-label="Clear search"
                    >
                        <X size={12} />
                    </button>
                )}

                {/* Trigger / submit icon — hamesha pill ke right edge par rehta hai */}
                <button
                    type="button"
                    aria-label="Search"
                    onClick={handleIconClick}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#432817] transition-colors hover:bg-[#432817]/[0.05] hover:text-[#977150]"
                >
                    <Search size={17} strokeWidth={1.35} />
                </button>
            </div>

            {/* Compact results dropdown — pill ke bilkul neeche, same width aur
          same border color se seedha attach hota hai (koi gap/mismatch
          nahi — dono milkar ek hi continuous shape banate hain) */}
            {showDropdown && (
                <div className="absolute right-0 top-full z-50 w-[270px] overflow-hidden rounded-b-2xl border border-t-0 border-[#D1B79E]/70 bg-white shadow-[0_16px_45px_rgba(43,26,14,0.18)] sm:w-[320px]">
                    <div className="max-h-[70vh] overflow-y-auto p-2">
                        {/* Recent searches — sirf jab query khaali ho */}
                        {!trimmedQuery && recent.length > 0 && (
                            <div className="px-1.5 py-1.5">
                                <p className="mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-[#977150] uppercase">
                                    Recent
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {recent.map((term) => (
                                        <button
                                            key={term}
                                            type="button"
                                            onClick={() => {
                                                setQuery(term);
                                                goToAllResults(term);
                                            }}
                                            className="flex items-center gap-1 rounded-full border border-[#D1B79E]/60 bg-white px-2.5 py-1 text-[11.5px] text-[#432817] transition-colors hover:border-[#977150]"
                                        >
                                            <Clock size={10} className="text-[#977150]" />
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active search results */}
                        {trimmedQuery && (
                            <>
                                {isLoading && (
                                    <div className="py-0.5">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <SkeletonRow key={i} />
                                        ))}
                                    </div>
                                )}

                                {!isLoading && error && (
                                    <p className="px-2 py-8 text-center text-[12.5px] text-red-700/80">
                                        {error}
                                    </p>
                                )}

                                {!isLoading && !error && results.length === 0 && (
                                    <div className="px-2 py-8 text-center">
                                        <p className="text-[13px] font-medium text-[#432817]">
                                            No products found
                                        </p>
                                        <p className="mt-1 text-[11.5px] text-[#977150]">
                                            Try a different keyword
                                        </p>
                                    </div>
                                )}

                                {!isLoading && !error && results.length > 0 && (
                                    <>
                                        <ul>
                                            {results.map((product, index) => {
                                                const price = product.sale_price ?? product.price;
                                                const hasDiscount =
                                                    product.sale_price &&
                                                    Number(product.sale_price) < Number(product.price);
                                                const isActive = index === activeIndex;
                                                const productId = extractProductId(product);
                                                const inCart = productId && cartIdSet.has(productId);
                                                const inWishlist =
                                                    productId && wishlistIdSet.has(productId);

                                                return (
                                                    <li key={product.id ?? index}>
                                                        <button
                                                            type="button"
                                                            onMouseEnter={() => setActiveIndex(index)}
                                                            onClick={() => goToProduct(product)}
                                                            className={`flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors ${isActive
                                                                ? "bg-[#432817]/[0.05]"
                                                                : "hover:bg-[#432817]/[0.05]"
                                                                }`}
                                                        >
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#D1B79E]/40 bg-[#F5F2EC]">
                                                                {product.image ? (
                                                                    <img
                                                                        src={product.image}
                                                                        alt={product.name}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <ImageOff size={13} className="text-[#D1B79E]" />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-[12px] font-medium text-[#432817]">
                                                                    {product.name}
                                                                </p>
                                                                <div className="mt-0.5 flex items-center gap-1">
                                                                    {inCart && (
                                                                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#432817]/10 px-1.5 py-[1px] text-[8px] font-semibold text-[#432817]">
                                                                            <ShoppingBag size={7} strokeWidth={2.2} />
                                                                            Cart
                                                                        </span>
                                                                    )}
                                                                    {inWishlist && (
                                                                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#B0503F]/10 px-1.5 py-[1px] text-[8px] font-semibold text-[#B0503F]">
                                                                            <Heart
                                                                                size={7}
                                                                                strokeWidth={2.2}
                                                                                className="fill-[#B0503F]"
                                                                            />
                                                                            Wishlist
                                                                        </span>
                                                                    )}
                                                                    {/* BUG FIX: this used to render brand_name (or
                                                                        category_name) as plain text only — e.g. just
                                                                        "Amazon" with no logo, even though the brand
                                                                        actually has one. The backend now returns
                                                                        brand_logo alongside brand_name, so a small
                                                                        circular logo renders next to the name here
                                                                        whenever both a brand AND its logo exist.
                                                                        category_name still falls back to text-only
                                                                        (categories don't have logos). */}
                                                                    {!inCart && !inWishlist && (product.brand_name || product.category_name) && (
                                                                        <span className="flex min-w-0 items-center gap-1">
                                                                            {product.brand_name && product.brand_logo && (
                                                                                <img
                                                                                    src={product.brand_logo}
                                                                                    alt={product.brand_name}
                                                                                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#D1B79E]/40 bg-white object-cover"
                                                                                />
                                                                            )}
                                                                            <span className="truncate text-[10.5px] text-[#977150]">
                                                                                {product.brand_name || product.category_name}
                                                                            </span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="shrink-0 text-right">
                                                                <p className="text-[11.5px] font-semibold text-[#432817]">
                                                                    {formatPrice(price)}
                                                                </p>
                                                                {hasDiscount && (
                                                                    <p className="text-[9.5px] text-[#977150]/70 line-through">
                                                                        {formatPrice(product.price)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>

                                        <button
                                            type="button"
                                            onClick={() => goToAllResults()}
                                            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-t border-[#D1B79E]/40 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-[#977150] uppercase transition-colors hover:text-[#432817]"
                                        >
                                            View all {total >= RESULTS_LIMIT ? `${total}+` : total} results
                                            <ArrowRight size={12} />
                                        </button>
                                    </>
                                )}

                                {/* Brands — search query se match hone wale brands, sabse
                    neeche. Click karte hi seedha us brand ke products
                    page (/brands/:slug) par navigate hota hai. */}
                                {matchingBrands.length > 0 && (
                                    <div className="mt-1 border-t border-[#D1B79E]/30 pt-2">
                                        <p className="mb-1.5 px-1.5 text-[10px] font-semibold tracking-[0.14em] text-[#977150] uppercase">
                                            Brands
                                        </p>
                                        <div className="flex flex-col gap-0.5">
                                            {matchingBrands.map((brand) => (
                                                <button
                                                    key={brand.id}
                                                    type="button"
                                                    onClick={() => {
                                                        closeSearch();
                                                        onNavigate(`/brands/${brand.slug}`);
                                                    }}
                                                    className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-[#432817]/[0.05]"
                                                >
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D1B79E]/40 bg-[#F5F2EC]">
                                                        {brand.logo ? (
                                                            <img
                                                                src={brand.logo}
                                                                alt={brand.name}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <Store size={13} className="text-[#D1B79E]" />
                                                        )}
                                                    </div>
                                                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#432817]">
                                                        {brand.name}
                                                    </span>
                                                    {typeof brand.product_count === "number" && (
                                                        <span className="shrink-0 text-[10.5px] text-[#977150]">
                                                            {brand.product_count}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}