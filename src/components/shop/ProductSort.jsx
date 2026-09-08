import { ChevronDown } from "lucide-react";

export default function ProductSort({
  value = "featured",
  onChange,
  productCount = 0,
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#D1B79E]/40 px-6 py-5 sm:px-10 lg:px-16">
      <p className="text-[10px] tracking-[0.18em] text-[#7E7E86] uppercase">
        {productCount} {productCount === 1 ? "Item" : "Items"}
      </p>

      <div className="relative flex items-center gap-3">
        <label
          htmlFor="product-sort"
          className="text-[10px] tracking-[0.15em] text-[#7E7E86] uppercase"
        >
          Sort
        </label>

        <div className="relative">
          <select
            id="product-sort"
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            className="cursor-pointer appearance-none bg-transparent py-1 pr-7 text-[10px] font-medium tracking-[0.1em] text-[#432817] uppercase outline-none"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name</option>
          </select>

          <ChevronDown
            size={13}
            strokeWidth={1.4}
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#432817]"
          />
        </div>
      </div>
    </div>
  );
}