import { Heart, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductCard({
  id,
  name = "Classic Fashion Item",
  price = 222,
  image,
  category,
  badge,
  isInCart = false,
  onAddToCart,
  isCartLoading = false,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [liked, setLiked] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  const activeUserId = user?.id || user?._id || user?.sub || user?.email;
  const queryKey = ["cart", activeUserId];

  // Sirf READ - cache check karne ke liye (isko save/write nahi karna, warna
  // double-write ka masla wapis aa jayega). Actual add/update sirf parent ke
  // useCart hook se hoga (single source of truth).
  const cartData = queryClient.getQueryData(queryKey) || { items: [] };
  const cachedItems = cartData.items || [];

  const isCachedInCart = cachedItems.some(
    (item) => String(item.productId || item.product_id) === String(id)
  );

  const isAddedLocal = isCachedInCart || isInCart;

  const formattedPrice =
    typeof price === "number" ? `$${price.toLocaleString()}` : price;

  const handleCardClick = () => {
    if (id) {
      navigate(`/product/${id}`);
    }
  };

  const handleQuickAdd = async (e) => {
    e.stopPropagation();
    if (isAdding || isAddedLocal || isCartLoading) return;

    if (!activeUserId) {
      setCartMessage("Please sign in first.");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    if (!onAddToCart) return;

    setIsAdding(true);
    setCartMessage("");

    try {
      // Ye single call hi cart add/update handle karega
      // (useCart hook -> API -> query cache invalidate/update).
      // Yahan koi alag fetch, localStorage ya queryClient.setQueryData
      // nahi karna - warna item DOUBLE save ho jayega.
      await onAddToCart(id);
    } catch (error) {
      console.error("Quick add error:", error);
      setCartMessage(error?.message || "Something went wrong.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <article
      onClick={handleCardClick}
      className="group cursor-pointer"
    >
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
          onClick={(e) => {
            e.stopPropagation();
            setLiked((prev) => !prev);
          }}
          aria-label={liked ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition-all ${liked
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

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={isAdding || isAddedLocal || isCartLoading}
          aria-label={isAddedLocal ? `${name} is in cart` : `Add ${name} to cart`}
          className={`absolute bottom-3 left-3 right-3 flex translate-y-3 items-center justify-center gap-2 py-3 text-[9px] font-medium tracking-[0.2em] uppercase transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 ${isAddedLocal
              ? "opacity-100 cursor-not-allowed bg-[#6F7663] text-[#F7F3EC]"
              : "bg-[#EDE6DA] text-[#432817] hover:bg-[#432817] hover:text-[#EDE6DA]"
            }`}
        >
          <ShoppingBag size={13} strokeWidth={1.4} />
          <span>
            {isAdding
              ? "Adding..."
              : isAddedLocal
                ? "Added to cart"
                : cartMessage || "Quick add"}
          </span>
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
          <p className="shrink-0 text-xs text-[#432817]">{formattedPrice}</p>
        </div>
      </div>
    </article>
  );
}
