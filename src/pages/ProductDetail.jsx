import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, ArrowLeft, Minus, Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import menProducts from "../data/men"; // <-- Men products data import karein

const CART_ADD_API_URL =
  "https://cart-worker-service.adeebibrahim01.workers.dev/cart/add";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  // Dynamically product find karein ID ke base par
  useEffect(() => {
    const fetchProductDetails = () => {
      setLoading(true);
      try {
        // Agar aapke paas real API hai toh yahan fetch laga sakte hain:
        // const res = await fetch(`YOUR_API_URL/${id}`);
        // const data = await res.json();

        // Filhal menProducts array mein se id match karke dynamic product nikal rahe hain
        const foundProduct = menProducts.find(
          (p) => String(p.id) === String(id)
        );

        if (foundProduct) {
          setProduct(foundProduct);
          setError(null);
        } else {
          setError("Product not found.");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product details.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProductDetails();
    }
  }, [id]);

  // Check karein ke kya yeh item pehle se cart mein hai
  useEffect(() => {
    try {
      const activeUserId = user?.id || user?._id || user?.sub || user?.email || 'guest';
      const savedCart = localStorage.getItem(`cart_items_${activeUserId}`);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        const exists = parsed.some((item) => String(item.productId || item.product_id) === String(id));
        if (exists) setAddedToCart(true);
      }
    } catch {
      // Ignore
    }
  }, [id, user]);

  const handleAddToCart = async () => {
    if (isAdding || addedToCart || !product) return;

    const activeUserId = user?.id || user?._id || user?.sub || user?.email;

    if (!activeUserId) {
      setCartMessage("Please sign in first.");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    setIsAdding(true);
    setCartMessage("");

    try {
      const response = await fetch(CART_ADD_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(activeUserId),
          productId: String(product.id),
          quantity: quantity,
          name: product.name,
          price: typeof product.price === "number" ? product.price : parseFloat(String(product.price).replace(/[^0-9.]/g, "")) || 0,
          image: product.image || "",
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
        throw new Error(data.message || "Failed to add item.");
      }

      setAddedToCart(true);
      setCartMessage("Added to cart successfully");

      // LocalStorage mein save karein persistence ke liye
      try {
        const storageKey = `cart_items_${activeUserId}`;
        const savedCart = localStorage.getItem(storageKey);
        let parsedCart = savedCart ? JSON.parse(savedCart) : [];
        
        if (!parsedCart.some((item) => String(item.productId || item.product_id) === String(product.id))) {
          parsedCart.push({ 
            productId: String(product.id), 
            name: product.name, 
            price: product.price, 
            image: product.image, 
            quantity 
          });
          localStorage.setItem(storageKey, JSON.stringify(parsedCart));
        }
      } catch {
        // Ignore
      }

      window.dispatchEvent(new Event("cart-change"));
    } catch (err) {
      console.error("Cart error:", err);
      setCartMessage(err.message || "Something went wrong.");
    } finally {
      setIsAdding(false);
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
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="group mb-8 flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] text-[#7E7E86] uppercase transition hover:text-[#432817]"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
        Back to collection
      </button>

      {/* Main Grid */}
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Product Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-[#D1B79E]/30">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#7E7E86]">
              No Image Available
            </div>
          )}
          {product.badge && (
            <div className="absolute left-4 top-4 bg-[#EDE6DA] px-3 py-1.5">
              <span className="text-[8px] font-medium tracking-[0.15em] text-[#432817] uppercase">
                {product.badge}
              </span>
            </div>
          )}
        </div>

        {/* Product Details info */}
        <div className="flex flex-col justify-center">
          {product.category && (
            <p className="mb-3 text-[10px] tracking-[0.25em] text-[#7E7E86] uppercase">
              {product.category}
            </p>
          )}

          <h1 className="font-serif text-3xl text-[#432817] sm:text-4xl">
            {product.name}
          </h1>

          <p className="mt-4 text-xl font-medium text-[#432817]">
            {typeof product.price === "number" ? `$${product.price.toLocaleString()}` : product.price}
          </p>

          <div className="my-6 h-[1px] w-full bg-[#D1B79E]/40" />

          <p className="text-sm leading-relaxed text-[#7E7E86]">
            {product.description || "Crafted with precision and premium materials, this piece offers timeless elegance and exceptional comfort for any occasion."}
          </p>

          {/* Quantity Selector */}
          <div className="mt-8 flex items-center gap-6">
            <span className="text-[10px] tracking-[0.2em] text-[#432817] uppercase font-medium">Quantity</span>
            <div className="flex items-center border border-[#D1B79E] bg-white">
              <button
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className="px-3 py-2 text-[#432817] hover:bg-[#EDE6DA]"
                disabled={addedToCart}
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-xs font-medium text-[#432817]">{quantity}</span>
              <button
                onClick={() => setQuantity((prev) => prev + 1)}
                className="px-3 py-2 text-[#432817] hover:bg-[#EDE6DA]"
                disabled={addedToCart}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={handleAddToCart}
              disabled={isAdding || addedToCart}
              className={`flex flex-1 items-center justify-center gap-3 py-4 text-[10px] font-medium tracking-[0.2em] uppercase transition-all ${
                addedToCart
                  ? "bg-[#6F7663] text-[#F7F3EC] cursor-not-allowed"
                  : "bg-[#432817] text-[#EDE6DA] hover:bg-[#5a3720]"
              }`}
            >
              <ShoppingBag size={16} strokeWidth={1.5} />
              {isAdding ? "Adding..." : addedToCart ? "Added to Cart" : "Add to Cart"}
            </button>

            {/* Wishlist Toggle */}
            <button
              onClick={() => setLiked((prev) => !prev)}
              aria-label="Wishlist"
              className={`flex h-13 w-13 items-center justify-center border transition-all ${
                liked
                  ? "border-[#432817] bg-[#432817] text-[#EDE6DA]"
                  : "border-[#D1B79E] text-[#432817] hover:border-[#432817]"
              }`}
            >
              <Heart size={18} strokeWidth={1.5} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>

          {cartMessage && (
            <p className={`mt-3 text-[10px] tracking-wide ${addedToCart ? "text-[#6F7663]" : "text-red-600"}`}>
              {cartMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}