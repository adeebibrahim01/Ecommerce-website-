import { Heart, ShoppingBag } from "lucide-react";
import { useState } from "react";

const CART_API_URL =
  "https://aurelia-cart-worker.adeebibrahim01.workers.dev/api/cart";

export default function ProductCard({
  id,
  name = "Classic Fashion Item",
  price = 129,
  image,
  category,
  badge,
  isInCart = false,
}) {
  const [liked, setLiked] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  const formattedPrice =
    typeof price === "number"
      ? `$${price.toLocaleString()}`
      : price;

  const handleQuickAdd = async () => {
    if (isAdding || isInCart) {
      return;
    }

    const savedUser =
      localStorage.getItem("user");

    if (!savedUser) {
      setCartMessage(
        "Please sign in first."
      );

      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);

      return;
    }

    let user;

    try {
      user = JSON.parse(savedUser);
    } catch (error) {
      console.error(
        "Failed to read user:",
        error
      );

      localStorage.removeItem("user");

      setCartMessage(
        "Please sign in again."
      );

      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);

      return;
    }

    if (!user || !user.id) {
      setCartMessage(
        "Please sign in first."
      );

      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);

      return;
    }

    if (!id) {
      setCartMessage(
        "Product ID is missing."
      );

      return;
    }

    setIsAdding(true);
    setCartMessage("");

    try {
      const response = await fetch(
        CART_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            productId: String(id),
            productName: name,
            price:
              typeof price === "number"
                ? price
                : Number(
                    String(price).replace(
                      /[^0-9.]/g,
                      ""
                    )
                  ),
            image: image || null,
            quantity: 1,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to add product to cart."
        );
      }

      setCartMessage(
        "Added to cart"
      );

      window.dispatchEvent(
        new Event("cart-change")
      );
    } catch (error) {
      console.error(
        "Quick add error:",
        error
      );

      setCartMessage(
        error.message ||
          "Something went wrong."
      );
    } finally {
      setIsAdding(false);
    }
  };

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
          onClick={() =>
            setLiked(
              (previous) => !previous
            )
          }
          aria-label={
            liked
              ? `Remove ${name} from wishlist`
              : `Add ${name} to wishlist`
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
            fill={
              liked
                ? "currentColor"
                : "none"
            }
          />
        </button>

        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={
            isAdding || isInCart
          }
          aria-label={
            isInCart
              ? `${name} is already in cart`
              : `Add ${name} to cart`
          }
          className={`absolute bottom-3 left-3 right-3 flex translate-y-3 items-center justify-center gap-2 py-3 text-[9px] font-medium tracking-[0.2em] uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 ${
            isInCart
              ? "cursor-not-allowed bg-[#6F7663] text-[#F7F3EC]"
              : "bg-[#EDE6DA] text-[#432817] hover:bg-[#432817] hover:text-[#EDE6DA]"
          } disabled:cursor-not-allowed disabled:opacity-100`}
        >
          <ShoppingBag
            size={13}
            strokeWidth={1.4}
          />

          <span>
            {isAdding
              ? "Adding..."
              : isInCart
                ? "Added to cart"
                : cartMessage ||
                  "Quick add"}
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

          <p className="shrink-0 text-xs text-[#432817]">
            {formattedPrice}
          </p>
        </div>
      </div>
    </article>
  );
}