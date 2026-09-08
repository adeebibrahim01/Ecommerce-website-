import { Heart, ShoppingBag } from "lucide-react";
import { useState } from "react";

export default function ProductCard({
  id,
  name = "Classic Fashion Item",
  price = 129,
  image,
  category,
  badge,
}) {
  const [liked, setLiked] = useState(false);

  const formattedPrice =
    typeof price === "number"
      ? `$${price.toLocaleString()}`
      : price;

  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#D1B79E]/30">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#D1B79E]/30">
            <span className="text-[10px] tracking-[0.2em] text-[#7E7E86] uppercase">
              No Image
            </span>
          </div>
        )}

        {badge && (
          <div className="absolute left-3 top-3 bg-[#EDE6DA] px-3 py-1.5">
            <span className="text-[8px] font-medium tracking-[0.15em] text-[#432817] uppercase">
              {badge}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setLiked((previous) => !previous)}
          aria-label={
            liked ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`
          }
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
            liked
              ? "bg-[#432817] text-[#EDE6DA]"
              : "bg-[#EDE6DA]/90 text-[#432817] hover:bg-[#432817] hover:text-[#EDE6DA]"
          }`}
        >
          <Heart
            size={16}
            strokeWidth={1.4}
            fill={liked ? "currentColor" : "none"}
          />
        </button>

        <button
          type="button"
          className="absolute bottom-3 left-3 right-3 flex translate-y-3 items-center justify-center gap-2 bg-[#EDE6DA] py-3 text-[9px] font-medium tracking-[0.2em] text-[#432817] uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-[#432817] hover:text-[#EDE6DA]"
        >
          <ShoppingBag size={13} strokeWidth={1.4} />
          <span>Quick add</span>
        </button>
      </div>

      <div className="pt-4">
        {category && (
          <p className="mb-2 text-[9px] tracking-[0.15em] text-[#7E7E86] uppercase">
            {category}
          </p>
        )}

        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xs font-medium tracking-wide text-[#432817]">
            {name}
          </h3>

          <p className="shrink-0 text-xs text-[#432817]">
            {formattedPrice}
          </p>
        </div>
      </div>
    </article>
  );
}