import { Heart } from "lucide-react";
import { useState } from "react";

export default function ProductCard({
  name = "Classic Fashion Item",
  price = "$129",
  image,
}) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="group">
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[#D1B79E]/30">
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />

        {/* Wishlist */}
        <button
          onClick={() => setLiked(!liked)}
          aria-label="Add to wishlist"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#EDE6DA]/90 text-[#432817] backdrop-blur-sm transition hover:bg-[#432817] hover:text-white"
        >
          <Heart
            size={16}
            strokeWidth={1.4}
            fill={liked ? "currentColor" : "none"}
          />
        </button>

        {/* Quick add */}
        <button className="absolute bottom-3 left-3 right-3 translate-y-3 bg-[#EDE6DA] py-3 text-[9px] font-medium tracking-[0.2em] text-[#432817] uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-[#432817] hover:text-white">
          Quick add
        </button>
      </div>

      {/* Product info */}
      <div className="pt-4">
        <h3 className="text-xs font-medium tracking-wide text-[#432817]">
          {name}
        </h3>

        <p className="mt-2 text-xs text-[#7E7E86]">
          {price}
        </p>
      </div>
    </article>
  );
}