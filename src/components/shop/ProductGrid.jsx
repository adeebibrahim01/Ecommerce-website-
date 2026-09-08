import { useMemo, useState } from "react";

import menProducts from "../data/men";

import ProductCard from "../components/shop/ProductCard";
import ProductFilters from "../components/shop/ProductFilters";
import ProductSort from "../components/shop/ProductSort";

export default function ProductGrid({ category }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");

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
    // All | Clothing | Outerwear | Tops | Bottoms | Shoes
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
        result.sort(
          (a, b) => Number(a.price) - Number(b.price)
        );
        break;

      case "price-high":
        result.sort(
          (a, b) => Number(b.price) - Number(a.price)
        );
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
            Number(b.featured || 0) -
            Number(a.featured || 0)
        );
        break;
    }

    return result;
  }, [category, selectedCategory, sortBy]);

  return (
    <section className="bg-[#EDE6DA]">
      {/* Filters */}
      <ProductFilters
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Sorting */}
      <ProductSort
        value={sortBy}
        onChange={setSortBy}
        productCount={filteredAndSortedProducts.length}
      />

      {/* Products */}
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16 lg:py-16">
        {filteredAndSortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7 lg:gap-y-16">
            {filteredAndSortedProducts.map((product) => (
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
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <p className="font-serif text-3xl text-[#432817]">
              No pieces found
            </p>

            <p className="mt-3 max-w-sm text-xs leading-6 text-[#7E7E86]">
              We couldn't find any products matching
              your selected filter.
            </p>

            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className="mt-6 border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.18em] text-[#432817] uppercase"
            >
              View all pieces
            </button>
          </div>
        )}
      </div>
    </section>
  );
}