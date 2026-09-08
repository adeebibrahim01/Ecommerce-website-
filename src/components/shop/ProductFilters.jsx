import { SlidersHorizontal } from "lucide-react";

export default function ProductFilters({
  selectedCategory = "All",
  onCategoryChange,
}) {
  const categories = [
    "All",
    "Clothing",
    "Outerwear",
    "Tops",
    "Bottoms",
    "Shoes",
  ];

  return (
    <div className="border-b border-[#D1B79E]/60 bg-[#EDE6DA]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-16">
        
        <div className="flex items-center gap-3">
          <SlidersHorizontal
            size={15}
            strokeWidth={1.4}
            className="text-[#432817]"
          />

          <span className="text-[10px] font-medium tracking-[0.2em] text-[#432817] uppercase">
            Filter
          </span>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {categories.map((category) => {
            const isActive = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategoryChange?.(category)}
                className={`relative pb-1 text-[10px] font-medium tracking-[0.15em] uppercase transition-colors ${
                  isActive
                    ? "text-[#432817]"
                    : "text-[#7E7E86] hover:text-[#432817]"
                }`}
              >
                {category}

                {isActive && (
                  <span className="absolute bottom-0 left-0 h-px w-full bg-[#432817]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}