import { useState, useEffect, useMemo, useCallback } from "react";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id || user?._id || user?.sub || user?.email;

  const { cartItems, isLoading, removeFromCart, addToCart } = useCart(userId);
  const [checkoutAlert, setCheckoutAlert] = useState(false);

  const [localItems, setLocalItems] = useState([]);

  // Per-item pending lock (Set of product_ids currently being updated).
  // FIX: pehle ek hi global `isUpdatingRef` boolean tha jo EK item update
  // hone par POORI list ka sync 600ms ke liye rok deta tha (chahe koi
  // unrelated item ho). Ab sirf wahi item lock hota hai jo actually
  // update ho raha hai, aur lock hatna network response ka wait karta
  // hai (koi arbitrary setTimeout guess nahi) - is se fast network par
  // needless UI lock aur slow network par premature unlock, dono khatam
  // ho gaye.
  const [pendingIds, setPendingIds] = useState(() => new Set());

  const addPending = useCallback((id) => {
    setPendingIds((prev) => new Set(prev).add(id));
  }, []);

  const removePending = useCallback((id) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Sync server cart -> local UI copy, lekin sirf jab koi item pending
  // update mein na ho (warna abhi jo optimistic value dikha rahe hain
  // wo cache ke purane snapshot se overwrite ho jayegi).
  useEffect(() => {
    if (cartItems && pendingIds.size === 0) {
      setLocalItems(cartItems);
    }
  }, [cartItems, pendingIds]);

  // NOTE: yahan pehle ek extra `refreshCart()` bhi call hoti thi mount
  // par - lekin useCart ke andar useQuery already `enabled: !!userId`
  // ke sath khud fetch kar leta hai. Wo extra call sirf DUPLICATE
  // network request thi - hata di gayi hai (performance fix).

  // Optimized Calculations using useMemo
  const { subtotal, shipping, grandTotal } = useMemo(() => {
    const sub = localItems.reduce(
      (acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    const ship = sub > 0 ? 10.0 : 0;
    return { subtotal: sub, shipping: ship, grandTotal: sub + ship };
  }, [localItems]);

  const handleRemove = useCallback(
    async (productId) => {
      addPending(productId);
      setLocalItems((prev) => prev.filter((i) => i.product_id !== productId));
      try {
        await removeFromCart(productId);
      } finally {
        removePending(productId);
      }
    },
    [removeFromCart, addPending, removePending]
  );

  const handleIncrease = useCallback(
    async (item) => {
      addPending(item.product_id);

      setLocalItems((prev) =>
        prev.map((i) =>
          i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );

      try {
        await addToCart(item.product_id, 1, {
          name: item.name,
          price: item.price,
          image: item.image,
        });
      } catch (error) {
        console.error("Failed to increase quantity", error);
      } finally {
        removePending(item.product_id);
      }
    },
    [addToCart, addPending, removePending]
  );

  const handleDecrease = useCallback(
    async (item) => {
      if (item.quantity <= 1) {
        handleRemove(item.product_id);
        return;
      }

      addPending(item.product_id);

      setLocalItems((prev) =>
        prev.map((i) =>
          i.product_id === item.product_id ? { ...i, quantity: i.quantity - 1 } : i
        )
      );

      try {
        // FIX: pehle yahan ek alag raw `fetch()` call thi jo useCart ke
        // cache/badge-count se disconnect thi. Ab wahi `addToCart`
        // mutation use ho rahi hai jo increase mein hoti hai, bas
        // quantity -1 (delta) ke sath - taake cart-icon count, cache
        // aur is page ka data hamesha sync rahe (single source of truth).
        await addToCart(item.product_id, -1, {
          name: item.name,
          price: item.price,
          image: item.image,
        });
      } catch (error) {
        console.error("Failed to decrease quantity", error);
      } finally {
        removePending(item.product_id);
      }
    },
    [addToCart, addPending, removePending, handleRemove]
  );

  return (
    <div className="min-h-screen bg-[#F7F3EC] px-4 py-8 md:px-12 lg:px-24">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-medium tracking-wider text-[#432817] transition-colors hover:text-[#977150]"
        >
          <ArrowLeft size={16} /> Continue Shopping
        </button>

        <h1 className="mt-4 font-serif text-2xl font-normal tracking-wide text-[#432817] md:text-3xl">
          Shopping Bag
        </h1>
        <p className="mt-1 text-xs text-[#8A8177]">
          Review your items before proceeding to checkout.
        </p>

        {isLoading && localItems.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-xs tracking-widest text-[#432817] uppercase animate-pulse">Loading bag...</p>
          </div>
        ) : localItems.length === 0 ? (
          <div className="my-20 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDE6DA] text-[#977150]">
              <ShoppingBag size={28} strokeWidth={1.2} />
            </div>
            <h2 className="mt-4 text-sm font-semibold tracking-widest text-[#432817] uppercase">Your bag is empty</h2>
            <p className="mt-1 text-xs text-[#8A8177]">Explore our collection and add your favorite pieces.</p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 rounded-none bg-[#432817] px-8 py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase transition-all hover:bg-[#977150]"
            >
              Shop Now
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {localItems.map((item) => {
                const isPending = pendingIds.has(item.product_id);
                return (
                  <div
                    key={item.product_id}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#D1B79E]/40 pb-4 bg-white/40 p-4 rounded-xl transition-all ${isPending ? "opacity-60" : ""
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#D1B79E]/30">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#977150]">
                            <ShoppingBag size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-[#432817]">
                          {item.name || "Classic Fashion Item"}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-[#977150]">
                          ${Number(item.price || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                      <div className="flex items-center border border-[#D1B79E] rounded-md bg-white">
                        <button
                          onClick={() => handleDecrease(item)}
                          disabled={isPending}
                          className="p-1.5 text-[#432817] hover:bg-[#EDE6DA] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-3 text-xs font-medium text-[#432817]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleIncrease(item)}
                          disabled={isPending}
                          className="p-1.5 text-[#432817] hover:bg-[#EDE6DA] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <p className="text-xs font-semibold text-[#432817]">
                        ${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}
                      </p>

                      <button
                        onClick={() => handleRemove(item.product_id)}
                        disabled={isPending}
                        className="text-[#8A8177] hover:text-red-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-[#D1B79E]/60 bg-white/60 p-6 shadow-sm backdrop-blur-md h-fit">
              <h2 className="text-xs font-semibold tracking-[0.15em] text-[#432817] uppercase border-b border-[#D1B79E]/40 pb-3">
                Order Summary
              </h2>

              <div className="mt-4 space-y-3 text-xs text-[#432817]">
                <div className="flex justify-between">
                  <span className="text-[#8A8177]">Subtotal</span>
                  <span className="font-medium">${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8177]">Estimated Shipping</span>
                  <span className="font-medium">${shipping.toLocaleString()}</span>
                </div>
                <div className="border-t border-[#D1B79E]/40 pt-3 flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>${grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setCheckoutAlert(true)}
                className="mt-6 w-full rounded-none bg-[#432817] py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase transition-all hover:bg-[#977150]"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>

      {checkoutAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#F7F3EC] p-6 text-center shadow-2xl border border-[#D1B79E]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE6DA] text-[#432817]">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="mt-4 text-sm font-semibold tracking-wider text-[#432817] uppercase">
              Checkout Successful!
            </h3>
            <p className="mt-2 text-xs text-[#8A8177]">
              Thank you for your purchase. Your order has been placed successfully.
            </p>
            <button
              onClick={() => {
                setCheckoutAlert(false);
                navigate("/");
              }}
              className="mt-6 w-full rounded-none bg-[#432817] py-2.5 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase transition-all hover:bg-[#977150]"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}