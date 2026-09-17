import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import Hero from "../components/home/Hero";
import Categories from "../components/home/Categories";
import Banner from "../components/home/Banner";
import ProductCard from "../components/shop/ProductCard";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";

// ==========================================
// API CONFIG
// ==========================================

const PRODUCT_API_BASE =
  import.meta.env.VITE_PRODUCT_API_URL ||
  "https://product-worker-service.adeebibrahim01.workers.dev";

// ==========================================
// PRODUCT API
// ==========================================

async function fetchProductsByFilter(filter, signal) {
  const params = new URLSearchParams({
    page: "1",
    limit: "4",
    [filter]: "1",
  });

  const res = await fetch(`${PRODUCT_API_BASE}/products?${params.toString()}`, {
    signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to load ${filter} products (status ${res.status})`);
  }

  const data = await res.json();

  if (!data?.success) {
    throw new Error(data?.message || `Failed to load ${filter} products.`);
  }

  return data.products || [];
}

// ==========================================
// PRODUCT NORMALIZER
// ==========================================

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.sale_price ?? row.price,
    originalPrice: row.price,
    isOnSale:
      Boolean(row.is_on_sale) ||
      (row.sale_price != null && Number(row.sale_price) < Number(row.price)),
    image: row.image,
    type: row.type,
    badge: row.badge,
    is_new_in: row.is_new_in,
    featured: row.featured,
    bestseller: row.bestseller,
  };
}

// ==========================================
// SHIMMER
// ==========================================

function ShimmerBlock({ className = "" }) {
  return <div className={`aurelia-home-shimmer ${className}`} />;
}

function ProductCardSkeleton() {
  return (
    <div>
      <ShimmerBlock className="aspect-[4/5] w-full overflow-hidden" />
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

// ==========================================
// SCROLL REVEAL (one orchestrated moment per
// section, not per-card — fires once, respects
// reduced-motion, and never blocks content if
// IntersectionObserver is unavailable)
// ==========================================

function useSectionReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

// ==========================================
// PRODUCT QUERY HOOK
// Centralizes retry + caching policy for all
// three collections instead of a bespoke
// Promise.all/useEffect per page.
// ==========================================

function useProductCollection(filterKey) {
  return useQuery({
    queryKey: ["home-products", filterKey],
    queryFn: ({ signal }) => fetchProductsByFilter(filterKey, signal),
    staleTime: 5 * 60 * 1000, // 5 min — collections don't churn every page view
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    select: (rows) => rows.map(normalizeProduct),
  });
}

// ==========================================
// REUSABLE COLLECTION SECTION
// Replaces three near-identical JSX blocks.
// Owns its own loading/error/empty states so
// each collection can recover independently —
// a failed "Bestseller" fetch no longer has to
// wait on or affect "Featured".
// ==========================================

function ProductSection({
  eyebrow = "Curated collection",
  title,
  viewAllHref,
  query,
  isProductInCart,
  onAddToCart,
  isCartLoading,
}) {
  const [ref, visible] = useSectionReveal();
  const { data: products, isLoading, isError, error, refetch, isFetching } = query;

  return (
    <section
      ref={ref}
      className={`px-5 py-20 transition-opacity duration-700 ease-out sm:px-8 md:px-12 lg:px-16 ${visible ? "opacity-100" : "opacity-0"
        }`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-3 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
              {eyebrow}
            </p>
            <h2 className="font-serif text-4xl leading-none sm:text-5xl">{title}</h2>
          </div>

          <a
            href={viewAllHref}
            className="hidden border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:text-[#977150] sm:block"
          >
            View all
          </a>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="text-xs text-[#7E7E86]">
              {error?.message || `Couldn't load ${title.toLowerCase()} right now.`}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-b border-[#432817] pb-0.5 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:text-[#977150] disabled:opacity-50"
            >
              {isFetching ? "Retrying…" : "Try again"}
            </button>
          </div>
        ) : products.length === 0 ? (
          <p className="text-xs text-[#7E7E86]">Nothing here yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                image={product.image}
                category={product.type}
                badge={product.badge}
                isInCart={isProductInCart(product.id)}
                onAddToCart={() => onAddToCart(product)}
                isCartLoading={isCartLoading}
                originalPrice={product.isOnSale ? product.originalPrice : null}
              />
            ))}
          </div>
        )}

        <div className="mt-10 text-center sm:hidden">
          <a
            href={viewAllHref}
            className="border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase"
          >
            View all
          </a>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// HOME
// ==========================================

export default function Home({ userId: userIdProp }) {
  const { user } = useAuth();
  const activeUserId =
    userIdProp || user?.id || user?._id || user?.sub || user?.email || null;

  const { cartItems, addToCart, isLoading: isCartLoading } = useCart(activeUserId);

  const newArrivalsQuery = useProductCollection("is_new_in");
  const featuredQuery = useProductCollection("featured");
  const bestsellerQuery = useProductCollection("bestseller");

  // ==========================================
  // CART HELPERS
  // ==========================================

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

  const handleAddToCart = async (product) => {
    if (!product?.id) return;

    if (!activeUserId) {
      alert("Please log in to add items to cart.");
      return;
    }

    // Sale par ho (sale_price < price) to "was" price bhi cart tak bhejte
    // hain — bilkul CategoryPage/DealDetailPage jaisa — taake cart mein
    // strikethrough sahi se dikhe.
    await addToCart(product.id, 1, {
      name: product.name,
      price: product.price,
      image: product.image,
      originalPrice: product.isOnSale ? product.originalPrice : null,
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#EDE6DA] text-[#432817]">
      <style>{`
        @keyframes aurelia-home-shimmer-sweep {
          0% { background-position: -300% 0; }
          100% { background-position: 300% 0; }
        }

        .aurelia-home-shimmer {
          background-color: rgba(209, 183, 158, 0.28);
          background-image: linear-gradient(
            100deg,
            rgba(209, 183, 158, 0.28) 30%,
            rgba(255, 255, 255, 0.65) 50%,
            rgba(209, 183, 158, 0.28) 70%
          );
          background-size: 300% 100%;
          animation: aurelia-home-shimmer-sweep 1.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurelia-home-shimmer {
            animation: none;
            background-image: none;
          }

          section[class*="transition-opacity"] {
            transition: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <main>
        <Banner placement="home_hero" />
        <Categories />

        <ProductSection
          title="New Arrivals"
          viewAllHref="/new-arrivals"
          query={newArrivalsQuery}
          isProductInCart={isProductInCart}
          onAddToCart={handleAddToCart}
          isCartLoading={isCartLoading}
        />

        <ProductSection
          title="Bestseller"
          viewAllHref="/bestsellers"
          query={bestsellerQuery}
          isProductInCart={isProductInCart}
          onAddToCart={handleAddToCart}
          isCartLoading={isCartLoading}
        />

        <ProductSection
          title="Featured"
          viewAllHref="/featured"
          query={featuredQuery}
          isProductInCart={isProductInCart}
          onAddToCart={handleAddToCart}
          isCartLoading={isCartLoading}
        />

        <Banner placement="home_secondary" />
      </main>
    </div>
  );
}