import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, ArrowLeft, Minus, Plus, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import menProducts from "../data/men";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const activeUserId = user?.id || user?._id || user?.sub || user?.email || null;

  // Same hook, same query key ("cart", activeUserId) as Navbar and CartPage —
  // so an add here is instantly visible everywhere else, no custom events needed.
  const { cartItems, addToCart, isMutating } = useCart(activeUserId);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartMessageTone, setCartMessageTone] = useState("neutral"); // "good" | "bad"

  // Find the product by id.
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    try {
      const foundProduct = menProducts.find((p) => String(p.id) === String(id));
      if (foundProduct) {
        setProduct(foundProduct);
        setError(null);
      } else {
        setError("Product not found.");
      }
    } catch (err) {
      console.error("Error loading product:", err);
      setError("Failed to load product details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // How many of this product are already in the bag — purely informational.
  const existingQuantity = (cartItems || [])
    .filter((item) => String(item.productId || item.product_id) === String(id))
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const handleAddToCart = async () => {
    if (!product) return;

    if (!activeUserId) {
      setCartMessageTone("bad");
      setCartMessage("Please sign in to add items to your bag.");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    setCartMessage("");

    // `quantity` here is a delta — "how many more to add" — matching how
    // useCart's /cart/add mutation and the backend SQL treat it everywhere else.
    const ok = await addToCart(product.id, quantity, {
      name: product.name,
      price:
        typeof product.price === "number"
          ? product.price
          : parseFloat(String(product.price).replace(/[^0-9.]/g, "")) || 0,
      image: product.image || "",
    });

    if (ok) {
      setCartMessageTone("good");
      setCartMessage(`Added ${quantity} to your bag.`);
      setQuantity(1);
    } else {
      setCartMessageTone("bad");
      setCartMessage("Something went wrong adding this to your bag. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7E7E86]">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-[#432817]">{error || "Product not found."}</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 bg-[#432817] px-6 py-3 text-[10px] tracking-[0.2em] text-[#EDE6DA] uppercase"
        >
          <ArrowLeft size={14} /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:px-12 lg:px-16">
      <button
        onClick={() => navigate(-1)}
        className="group mb-8 flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] text-[#7E7E86] uppercase transition hover:text-[#432817]"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
        Back to collection
      </button>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Product Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-[#D1B79E]/30">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#7E7E86]">No Image Available</div>
          )}
          {product.badge && (
            <div className="absolute left-4 top-4 bg-[#EDE6DA] px-3 py-1.5">
              <span className="text-[8px] font-medium tracking-[0.15em] text-[#432817] uppercase">
                {product.badge}
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex flex-col justify-center">
          {product.category && (
            <p className="mb-3 text-[10px] tracking-[0.25em] text-[#7E7E86] uppercase">{product.category}</p>
          )}

          <h1 className="font-serif text-3xl text-[#432817] sm:text-4xl">{product.name}</h1>

          <p className="mt-4 text-xl font-medium text-[#432817]">
            {typeof product.price === "number" ? `$${product.price.toLocaleString()}` : product.price}
          </p>

          <div className="my-6 h-[1px] w-full bg-[#D1B79E]/40" />

          <p className="text-sm leading-relaxed text-[#7E7E86]">
            {product.description ||
              "Crafted with precision and premium materials, this piece offers timeless elegance and exceptional comfort for any occasion."}
          </p>

          {existingQuantity > 0 && (
            <p className="mt-4 text-[10px] tracking-wide text-[#6F7663]">
              {existingQuantity} already in your bag.
            </p>
          )}

          {/* Quantity Selector — how many to add, never disabled */}
          <div className="mt-8 flex items-center gap-6">
            <span className="text-[10px] font-medium tracking-[0.2em] text-[#432817] uppercase">Quantity</span>
            <div className="flex items-center border border-[#D1B79E] bg-white">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className="px-3 py-2 text-[#432817] transition hover:bg-[#EDE6DA] disabled:opacity-30"
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-xs font-medium text-[#432817]">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.min(99, prev + 1))}
                className="px-3 py-2 text-[#432817] transition hover:bg-[#EDE6DA] disabled:opacity-30"
                disabled={quantity >= 99}
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isMutating}
              className={`flex flex-1 items-center justify-center gap-3 py-4 text-[10px] font-medium tracking-[0.2em] uppercase transition-all ${isMutating ? "cursor-wait bg-[#8a7a67] text-[#EDE6DA]" : "bg-[#432817] text-[#EDE6DA] hover:bg-[#5a3720]"
                }`}
            >
              {isMutating ? (
                "Adding..."
              ) : (
                <>
                  <ShoppingBag size={16} strokeWidth={1.5} /> Add to Cart
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setLiked((prev) => !prev)}
              aria-label="Wishlist"
              className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center border transition-all ${liked
                  ? "border-[#432817] bg-[#432817] text-[#EDE6DA]"
                  : "border-[#D1B79E] text-[#432817] hover:border-[#432817]"
                }`}
            >
              <Heart size={18} strokeWidth={1.5} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>

          {cartMessage && (
            <p
              className={`mt-3 flex items-center gap-1.5 text-[10px] tracking-wide ${cartMessageTone === "good" ? "text-[#6F7663]" : "text-red-600"
                }`}
            >
              {cartMessageTone === "good" && <Check size={12} />}
              {cartMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}