import { useEffect, useState } from "react";

import Hero from "../components/home/Hero";
import Categories from "../components/home/Categories";
import Banner from "../components/home/Banner";
import ProductCard from "../components/shop/ProductCard";

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

  const res = await fetch(
    `${PRODUCT_API_BASE}/products?${params.toString()}`,
    {
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to load ${filter} products (status ${res.status})`
    );
  }

  const data = await res.json();

  if (!data?.success) {
    throw new Error(
      data?.message || `Failed to load ${filter} products.`
    );
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
  return (
    <div
      className={`aurelia-home-shimmer ${className}`}
    />
  );
}

// ==========================================
// PRODUCT SKELETON
// ==========================================

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

// ==========================================
// HOME
// ==========================================

export default function Home() {
  const [newArrivals, setNewArrivals] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [bestSellerProducts, setBestSellerProducts] =
    useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ==========================================
  // LOAD PRODUCTS
  // ==========================================

  useEffect(() => {
    const controller = new AbortController();

    let cancelled = false;

    setIsLoading(true);
    setLoadError("");

    Promise.all([
      fetchProductsByFilter(
        "is_new_in",
        controller.signal
      ),

      fetchProductsByFilter(
        "featured",
        controller.signal
      ),

      fetchProductsByFilter(
        "bestseller",
        controller.signal
      ),
    ])
      .then(
        ([
          newRows,
          featuredRows,
          bestsellerRows,
        ]) => {
          if (cancelled) return;

          setNewArrivals(
            newRows.map(normalizeProduct)
          );

          setFeaturedProducts(
            featuredRows.map(normalizeProduct)
          );

          setBestSellerProducts(
            bestsellerRows.map(normalizeProduct)
          );
        }
      )
      .catch((err) => {
        if (cancelled) return;

        if (err.name === "AbortError") return;

        console.error(
          "Home products fetch error:",
          err
        );

        setLoadError(
          err.message ||
            "Failed to load products."
        );
      })
      .finally(() => {
        if (cancelled) return;

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#EDE6DA] text-[#432817]">
      <style>{`
        @keyframes aurelia-home-shimmer-sweep {
          0% {
            background-position: -300% 0;
          }

          100% {
            background-position: 300% 0;
          }
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

          animation:
            aurelia-home-shimmer-sweep
            1.6s
            ease-in-out
            infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurelia-home-shimmer {
            animation: none;
            background-image: none;
          }
        }
      `}</style>

      <main>
        {/* =====================================
            HERO
        ====================================== */}

        <Banner placement="home_hero" />

        {/* =====================================
            CATEGORIES
        ====================================== */}

        <Categories />

        {/* =====================================
            NEW ARRIVALS
        ====================================== */}

        <section className="px-5 py-20 sm:px-8 md:px-12 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="mb-3 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
                  Curated collection
                </p>

                <h2 className="font-serif text-4xl leading-none sm:text-5xl">
                  New Arrivals
                </h2>
              </div>

              <a
                href="/new-arrivals"
                className="hidden border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:text-[#977150] sm:block"
              >
                View all
              </a>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map(
                  (_, i) => (
                    <ProductCardSkeleton key={i} />
                  )
                )}
              </div>
            ) : loadError ? (
              <p className="text-xs text-[#7E7E86]">
                Couldn't load new arrivals right now.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {newArrivals.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    category={product.type}
                    badge={product.badge}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 text-center sm:hidden">
              <a
                href="/new-arrivals"
                className="border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase"
              >
                View all
              </a>
            </div>
          </div>
        </section>

        {/* =====================================
            BESTSELLER
        ====================================== */}

        <section className="px-5 py-20 sm:px-8 md:px-12 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="mb-3 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
                  Curated collection
                </p>

                <h2 className="font-serif text-4xl leading-none sm:text-5xl">
                  Bestseller
                </h2>
              </div>

              <a
                href="/bestsellers"
                className="hidden border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:text-[#977150] sm:block"
              >
                View all
              </a>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map(
                  (_, i) => (
                    <ProductCardSkeleton key={i} />
                  )
                )}
              </div>
            ) : loadError ? (
              <p className="text-xs text-[#7E7E86]">
                Couldn't load bestseller products right now.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {bestSellerProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    category={product.type}
                    badge={product.badge}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 text-center sm:hidden">
              <a
                href="/bestsellers"
                className="border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase"
              >
                View all
              </a>
            </div>
          </div>
        </section>

        {/* =====================================
            FEATURED
        ====================================== */}

        <section className="px-5 py-20 sm:px-8 md:px-12 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="mb-3 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
                  Curated collection
                </p>

                <h2 className="font-serif text-4xl leading-none sm:text-5xl">
                  Featured
                </h2>
              </div>

              <a
                href="/featured"
                className="hidden border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:text-[#977150] sm:block"
              >
                View all
              </a>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map(
                  (_, i) => (
                    <ProductCardSkeleton key={i} />
                  )
                )}
              </div>
            ) : loadError ? (
              <p className="text-xs text-[#7E7E86]">
                Couldn't load featured products right now.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    category={product.type}
                    badge={product.badge}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 text-center sm:hidden">
              <a
                href="/featured"
                className="border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase"
              >
                View all
              </a>
            </div>
          </div>
        </section>

        {/* =====================================
            DATABASE HOME BANNER
        ====================================== */}
<Banner placement="home_secondary" />
        
      </main>
    </div>
  );
}