import { useMemo, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

import menProducts from "../data/men";

import ProductCard from "../components/shop/ProductCard";
import ProductFilters from "../components/shop/ProductFilters";
import ProductSort from "../components/shop/ProductSort";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth"; // Auth hook import karein

export default function ProductGrid({ category, userId: propUserId }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");

  // Auth context se fallback userId lein agar prop me pass na ho
  const { user } = useAuth();
  const activeUserId = propUserId || user?.id || user?._id || user?.sub || user?.email;

  // Cart Hook initialize
  const { addToCart, isLoading: isCartLoading } = useCart(activeUserId);

  // Add to cart handler
  const handleAddToCart = async (productId) => {
    if (!activeUserId) {
      alert("Please log in to add items to cart.");
      return;
    }
    await addToCart(productId, 1);
  };

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...menProducts];

    // Main page category
    if (category) {
      result = result.filter(
        (product) =>
          product.category?.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter category from men.js
    if (selectedCategory !== "All") {
      result = result.filter(
        (product) =>
          product.filterCategory?.toLowerCase() ===
          selectedCategory.toLowerCase()
      );
    }

    // Sorting
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
  }, [category, selectedCategory, sortBy]);

  return (
    <section className="relative overflow-hidden bg-[#EDE6DA]">
      {/* Soft background atmosphere */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/25 to-transparent" />

      {/* FILTER / CONTROL AREA */}
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

      {/* SORT / RESULT BAR */}
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

      {/* PRODUCTS */}
      <div className="relative mx-auto max-w-[1600px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16 xl:px-16">
        {filteredAndSortedProducts.length > 0 ? (
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
                    onAddToCart={() => handleAddToCart(product.id)}
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