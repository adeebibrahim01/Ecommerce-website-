import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

import ProductCard from "../components/shop/ProductCard";
import ProductFilters from "../components/shop/ProductFilters";
import ProductSort from "../components/shop/ProductSort";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";

// FIX: pehle ye component `data/men.js` (static hardcoded file) se
// products le raha tha. Ab is ko database se lena hai — product-worker
// ka public `/products` endpoint (koi auth nahi chahiye) use kar rahe
// hain, jo `category` aur `filterCategory` query params support karta
// hai (worker code dekho: WHERE category = ? AND filter_category = ?).
//
// IMPORTANT: apna actual product-worker URL yahan set karo — best
// tareeqa .env file mein VITE_PRODUCT_API_URL daalna hai, e.g.:
//   VITE_PRODUCT_API_URL=https://aurelia-product-worker.your-subdomain.workers.dev
const API_BASE =
  import.meta.env.VITE_PRODUCT_API_URL || "https://product-worker-service.adeebibrahim01.workers.dev";

// Worker ka /products endpoint max limit=50 per page allow karta hai,
// is liye agar category mein 50 se zyada products hon to hum pagination
// loop laga kar sab pages khींch lete hain (backend pe sab dikhane ke liye).
async function fetchAllProductsByCategory(category, signal) {
  const all = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (category) params.set("category", category);

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
// expect karti hai jaisa pehle `data/men.js` deta tha. Yahan normalize
// kar rahe hain taake neeche ka baqi code bilkul same rahe.
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

export default function ProductGrid({ category, userId: userIdProp }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");

  const { user } = useAuth();
  const userId = userIdProp || user?.id;

  const { cartItems, addToCart, isLoading: isCartLoading } = useCart(userId);

  // Database se products laana hai jab bhi `category` (page ka prop, jaise
  // "men") change ho. Baqi filtering (selectedCategory) aur sorting client
  // side hi hoti hai, taake UI turant respond kare aur bar bar API call na ho.
  useEffect(() => {
    const controller = new AbortController();

    setIsLoadingProducts(true);
    setLoadError("");

    fetchAllProductsByCategory(category, controller.signal)
      .then((rows) => {
        setProducts(rows.map(normalizeProduct));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Product fetch error:", err);
        setLoadError(err.message || "Failed to load products.");
      })
      .finally(() => {
        setIsLoadingProducts(false);
      });

    return () => controller.abort();
  }, [category]);

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
                Collection
              </span>

              <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[#CFC4B5] bg-white/35 px-2 text-[10px] font-semibold text-[#432817]">
                {filteredAndSortedProducts.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex min-h-[68px] items-center justify-between gap-4 border-b border-[#D8CFC2]/60">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#432817]">
                {filteredAndSortedProducts.length}
              </span>

              <span className="text-[10px] tracking-[0.12em] text-[#8A8177] uppercase">
                {filteredAndSortedProducts.length === 1
                  ? "piece"
                  : "pieces"}
              </span>
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
          <div className="flex min-h-[460px] items-center justify-center">
            <p className="text-xs tracking-[0.16em] text-[#8A8177] uppercase">
              Loading products...
            </p>
          </div>
        ) : loadError ? (
          <div className="flex min-h-[460px] items-center justify-center">
            <div className="max-w-md text-center">
              <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                Something went wrong
              </p>
              <h3 className="font-serif text-2xl text-[#432817]">
                Couldn't load products
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-xs leading-6 text-[#7E7E86]">
                {loadError}
              </p>
            </div>
          </div>
        ) : filteredAndSortedProducts.length > 0 ? (
          <>
            <div className="mb-9 flex items-end justify-between gap-6 lg:mb-12">
              <div>
                <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                  Curated selection
                </p>

                <h2 className="font-serif text-3xl leading-none tracking-[-0.02em] text-[#432817] sm:text-4xl">
                  {selectedCategory === "All"
                    ? "The Collection"
                    : selectedCategory}
                </h2>
              </div>

              <div className="hidden h-px flex-1 bg-[#D8CFC2] sm:block" />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
              {filteredAndSortedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group min-w-0"
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
                No pieces found
              </h3>

              <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">
                We couldn't find any products matching your
                selected filter. Try exploring another category.
              </p>

              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                className="mt-8 inline-flex items-center justify-center rounded-full border border-[#432817] bg-[#432817] px-7 py-3 text-[9px] font-semibold tracking-[0.18em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
              >
                View all pieces
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}