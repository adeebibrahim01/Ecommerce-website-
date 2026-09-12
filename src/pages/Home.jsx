import { useEffect, useState } from "react";

import Hero from "../components/home/Hero";
import Categories from "../components/home/Categories";
import ProductCard from "../components/shop/ProductCard";

// FIX: `Navbar` aur `Footer` pehle yahan import to ho rahe the, lekin
// kabhi render nahi hote the — `App.jsx` ka `MainLayout` already dono ko
// wrap kar deta hai. Wo import dead code tha (ya agar future mein galti
// se JSX mein daal diya jata, to Navbar/Footer do baar dikhte). Is liye
// hata diya — Home ab sirf apna khud ka content deta hai, layout ka
// kaam MainLayout par chhod deta hai.

const API_BASE =
  import.meta.env.VITE_PRODUCT_API_URL || "https://product-worker-service.adeebibrahim01.workers.dev";

// FIX: "New Arrivals" pehle static hardcoded `products` array se aa
// raha tha. Ab baaki site (Men/Women/Product-detail) ki tarah database
// se lete hain — sirf `featured=1` (ya naye) products, limit 4, taake
// home page halki rahe.
async function fetchNewArrivals(signal) {
  const params = new URLSearchParams({
    page: "1",
    limit: "4",
    featured: "1",
  });

  const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
    signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to load new arrivals (status ${res.status})`);
  }

  const data = await res.json();
  if (!data?.success) {
    throw new Error(data?.message || "Failed to load new arrivals.");
  }

  return data.products || [];
}

// Actual table schema ke mutabiq normalize.
function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.sale_price ?? row.price,
    image: row.image,
    type: row.type,
    badge: row.badge,
  };
}

function ShimmerBlock({ className = "" }) {
  return <div className={`aurelia-home-shimmer ${className}`} />;
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

export default function Home() {
  const [newArrivals, setNewArrivals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // FIX (race condition): same `cancelled` flag pattern jo baaki
  // fetching pages (CategoryPage, ProductDetail) mein use hota hai —
  // `abort()` sirf fetch ki promise reject karta hai, `.finally` ko
  // nahi rokta, is liye stale request ka result latest state ko
  // overwrite nahi karna chahiye.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setLoadError("");

    fetchNewArrivals(controller.signal)
      .then((rows) => {
        if (cancelled) return;
        setNewArrivals(rows.map(normalizeProduct));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.name === "AbortError") return;
        console.error("New arrivals fetch error:", err);
        setLoadError(err.message || "Failed to load new arrivals.");
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
          .aurelia-home-shimmer { animation: none; background-image: none; }
        }
      `}</style>

      <main>
        <Hero />

        <Categories />

        {/* New Arrivals */}
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
                href="/men"
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
                href="/men"
                className="border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase"
              >
                View all
              </a>
            </div>
          </div>
        </section>

        {/* Editorial Campaign */}
        <section className="px-5 pb-20 sm:px-8 md:px-12 lg:px-16">
          <div className="relative mx-auto max-w-7xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85"
              alt="Fashion collection"
              className="h-[500px] w-full object-cover sm:h-[600px]"
            />

            <div className="absolute inset-0 bg-[#432817]/25" />

            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
              <div>
                <p className="mb-4 text-[10px] tracking-[0.35em] uppercase">
                  The new collection
                </p>

                <h2 className="font-serif text-5xl leading-none sm:text-7xl">
                  Effortless
                  <br />
                  Elegance
                </h2>

                <button className="mt-8 border border-white px-7 py-3 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:bg-white hover:text-[#432817]">
                  Explore collection
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}