import { Heart, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const CART_ADD_API_URL =
  "https://cart-worker-service.adeebibrahim01.workers.dev/cart/add";

export default function ProductCard({
  id,
  name = "Classic Fashion Item",
  price = 129,
  image,
  category,
  badge,
  isInCart = false,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [liked, setLiked] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [addedToCart, setAddedToCart] = useState(isInCart);

  useEffect(() => {
    setAddedToCart(isInCart);
    if (!isInCart) setCartMessage("");
  }, [isInCart]);

  const formattedPrice =
    typeof price === "number" ? `$${price.toLocaleString()}` : price;

  const handleQuickAdd = async () => {
    if (isAdding || addedToCart) return;

    // Direct Auth State Check
    const activeUserId = user?.id || user?._id || user?.sub || user?.email;

    if (!activeUserId) {
      setCartMessage("Please sign in first.");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    if (!id) {
      setCartMessage("Product ID is missing.");
      return;
    }

    setIsAdding(true);
    setCartMessage("");

    try {
      // Yahan ab name, price aur image bhi body mein pass ki ja rahi hai
      const response = await fetch(CART_ADD_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(activeUserId),
          productId: String(id),
          quantity: 1,
          name: name,
          price: typeof price === "number" ? price : parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0,
          image: image || "",
        }),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Server error (404/Invalid JSON)");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to add item.");
      }

      setAddedToCart(true);
      setCartMessage("Added to cart");
      window.dispatchEvent(new Event("cart-change"));
    } catch (error) {
      console.error("Quick add error:", error);
      setCartMessage(error.message || "Something went wrong.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <article className="group">
      {/* Product Image Container */}
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

        {/* Badge */}
        {badge && (
          <div className="absolute left-3 top-3 bg-[#EDE6DA] px-3 py-1.5">
            <span className="text-[8px] font-medium tracking-[0.15em] text-[#432817] uppercase">
              {badge}
            </span>
          </div>
        )}

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={() => setLiked((prev) => !prev)}
          aria-label={liked ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
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

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={isAdding || addedToCart}
          aria-label={addedToCart ? `${name} is in cart` : `Add ${name} to cart`}
          className={`absolute bottom-3 left-3 right-3 flex translate-y-3 items-center justify-center gap-2 py-3 text-[9px] font-medium tracking-[0.2em] uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 ${
            addedToCart
              ? "cursor-not-allowed bg-[#6F7663] text-[#F7F3EC]"
              : "bg-[#EDE6DA] text-[#432817] hover:bg-[#432817] hover:text-[#EDE6DA]"
          } disabled:cursor-not-allowed disabled:opacity-100`}
        >
          <ShoppingBag size={13} strokeWidth={1.4} />
          <span>
            {isAdding
              ? "Adding..."
              : addedToCart
              ? "Added to cart"
              : cartMessage || "Quick add"}
          </span>
        </button>
      </div>

      {/* Product Information */}
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