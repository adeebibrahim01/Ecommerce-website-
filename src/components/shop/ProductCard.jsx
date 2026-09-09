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
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [liked, setLiked] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  const activeUserId = user?.id || user?._id || user?.sub || user?.email;
  const queryKey = ["cart", activeUserId];

  // TanStack Query cache se direct check karein ke yeh product cart mein mojud hai ya nahi
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
    if (isAdding || isAddedLocal) return;

    if (!activeUserId) {
      setCartMessage("Please sign in first.");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    if (!id || !name || name === "Classic Fashion Item" || price === 129) {
      setCartMessage("Invalid product data.");
      return;
    }

    setIsAdding(true);
    setCartMessage("");

    const numericPrice = typeof price === "number" ? price : parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
    const productImage = image || "";

    try {
      // 1. Optimistic Update in TanStack Query Cache
      await queryClient.cancelQueries({ queryKey });
      const previousCart = queryClient.getQueryData(queryKey);

      const newItem = {
        productId: String(id),
        product_id: String(id),
        quantity: 1,
        name: name,
        price: numericPrice,
        image: productImage,
      };

      queryClient.setQueryData(queryKey, (old = { items: [], totalCount: 0 }) => {
        const items = [...(old.items || [])];
        const existingIndex = items.findIndex(
          (item) => String(item.productId || item.product_id) === String(id)
        );

        if (existingIndex > -1) {
          items[existingIndex] = {
            ...items[existingIndex],
            quantity: Number(items[existingIndex].quantity || 0) + 1,
          };
        } else {
          items.push(newItem);
        }

        const totalQuantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
        return { items, totalCount: totalQuantity };
      });

      // 2. API Call to Cloudflare Worker
      const response = await fetch("https://cart-worker-service.adeebibrahim01.workers.dev/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(activeUserId),
          productId: String(id),
          quantity: 1,
          name: name,
          price: numericPrice,
          image: productImage,
        }),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Server error (Invalid JSON)");
      }

      if (!response.ok || !data.success) {
        queryClient.setQueryData(queryKey, previousCart);
        throw new Error(data.message || data.error || "Failed to add item.");
      }

      // 3. LocalStorage Persistence Sync
      try {
        const storageKey = `cart_items_${activeUserId}`;
        const savedCart = localStorage.getItem(storageKey);
        let parsedCart = savedCart ? JSON.parse(savedCart) : [];
        
        if (!parsedCart.some((item) => String(item.productId || item.product_id) === String(id))) {
          parsedCart.push(newItem);
          localStorage.setItem(storageKey, JSON.stringify(parsedCart));
        }
      } catch {
        // Ignore storage errors
      }

      window.dispatchEvent(new Event("cart-change"));
      
      if (onAddToCart) {
        onAddToCart(id);
      }
    } catch (error) {
      console.error("Quick add error:", error);
      setCartMessage(error.message || "Something went wrong.");
    } finally {
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey });
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
          disabled={isAdding || isAddedLocal}
          aria-label={isAddedLocal ? `${name} is in cart` : `Add ${name} to cart`}
          className={`absolute bottom-3 left-3 right-3 flex translate-y-3 items-center justify-center gap-2 py-3 text-[9px] font-medium tracking-[0.2em] uppercase transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 ${
            isAddedLocal
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