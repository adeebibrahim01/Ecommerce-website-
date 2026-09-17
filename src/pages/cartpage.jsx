import { useState, useEffect, useMemo, useCallback } from "react";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CheckCircle2, Tag } from "lucide-react";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id || user?._id || user?.sub || user?.email;

  const [checkoutAlert, setCheckoutAlert] = useState(false);

  const {
    cartItems, isLoading, removeFromCart, addToCart, startCheckout, isStartingCheckout,
    loyalty, validateCoupon, isValidatingCoupon,
  } = useCart(userId);
  const [checkoutError, setCheckoutError] = useState("");
  const [localItems, setLocalItems] = useState([]);
  const [redeemPoints, setRedeemPoints] = useState(0);

  // ---- Coupon state ----
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, description, discount }
  const [couponError, setCouponError] = useState("");

  // A product can now have BOTH a normal line and a deal line in the cart
  // at once, so product_id alone no longer uniquely identifies a row —
  // use product_id + deal_id together everywhere below.
  const lineKey = (item) => `${item.product_id}::${item.deal_id || ""}`;

  // Per-item pending lock (Set of line keys currently being updated).
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
  // update mein na ho.
  useEffect(() => {
    if (cartItems && pendingIds.size === 0) {
      setLocalItems(cartItems);
    }
  }, [cartItems, pendingIds]);

  // Optimized Calculations using useMemo
  const { subtotal, shipping, discount, couponDiscount, grandTotal, maxRedeemable, canRedeem } = useMemo(() => {
    const sub = localItems.reduce(
      (acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    const ship = sub > 0 ? 10.0 : 0;

    const s = loyalty?.settings;
    const balance = loyalty?.points || 0;
    let disc = 0;
    let maxPointsUsable = 0;
    let redeemAllowed = false;

    // Coupon applied hone par points redemption disable ho jata hai (mutually exclusive).
    if (!appliedCoupon && s?.is_enabled && balance >= (s.min_redeem_points || Infinity)) {
      redeemAllowed = true;
      const maxDiscountByPercent = (sub * s.max_redeem_percent) / 100;
      maxPointsUsable = Math.min(balance, Math.floor(maxDiscountByPercent * s.redeem_rate));
      const usedPoints = Math.min(redeemPoints, maxPointsUsable);
      disc = usedPoints / s.redeem_rate;
    }

    const couponDisc = appliedCoupon ? Number(appliedCoupon.discount) || 0 : 0;

    return {
      subtotal: sub,
      shipping: ship,
      discount: disc,
      couponDiscount: couponDisc,
      grandTotal: Math.max(0, sub + ship - disc - couponDisc),
      maxRedeemable: maxPointsUsable,
      canRedeem: redeemAllowed,
    };
  }, [localItems, loyalty, redeemPoints, appliedCoupon]);

  // Agar cart/points badal jayen aur pehle se selected redeemPoints naye
  // max sa zyada ho jaye, to usay clamp kar dein.
  useEffect(() => {
    if (redeemPoints > maxRedeemable) {
      setRedeemPoints(maxRedeemable);
    }
  }, [maxRedeemable, redeemPoints]);

  const handleRemove = useCallback(
    async (item) => {
      const key = lineKey(item);
      addPending(key);
      setLocalItems((prev) => prev.filter((i) => lineKey(i) !== key));
      try {
        await removeFromCart(item.product_id, item.deal_id || "");
      } finally {
        removePending(key);
      }
    },
    [removeFromCart, addPending, removePending]
  );

  const handleIncrease = useCallback(
    async (item) => {
      const key = lineKey(item);
      addPending(key);

      setLocalItems((prev) =>
        prev.map((i) => (lineKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i))
      );

      try {
        // NOTE: deal_id/deal_name/original_price bhi resend karna zaroori hai —
        // cart worker ka ON CONFLICT UPDATE in fields ko excluded value se
        // overwrite karta hai. Na bhejo to deal tag yahin null ho jata hai.
        await addToCart(item.product_id, 1, {
          name: item.name,
          price: item.price,
          image: item.image,
          dealId: item.deal_id || "",
          dealName: item.deal_name ?? null,
          originalPrice: item.original_price ?? null,
        });
      } catch (error) {
        console.error("Failed to increase quantity", error);
      } finally {
        removePending(key);
      }
    },
    [addToCart, addPending, removePending]
  );

  const handleDecrease = useCallback(
    async (item) => {
      if (item.quantity <= 1) {
        handleRemove(item);
        return;
      }

      const key = lineKey(item);
      addPending(key);

      setLocalItems((prev) =>
        prev.map((i) => (lineKey(i) === key ? { ...i, quantity: i.quantity - 1 } : i))
      );

      try {
        await addToCart(item.product_id, -1, {
          name: item.name,
          price: item.price,
          image: item.image,
          dealId: item.deal_id || "",
          dealName: item.deal_name ?? null,
          originalPrice: item.original_price ?? null,
        });
      } catch (error) {
        console.error("Failed to decrease quantity", error);
      } finally {
        removePending(key);
      }
    },
    [addToCart, addPending, removePending, handleRemove]
  );

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError("");
    const result = await validateCoupon(code);
    if (!result.success) {
      setCouponError(result.error || "Coupon apply nahi ho saka.");
      return;
    }
    setAppliedCoupon({ code: result.code, description: result.description, discount: result.discount });
    setRedeemPoints(0); // coupon aur points mutually exclusive
    setCouponInput("");
  }, [couponInput, validateCoupon]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError("");
  }, []);

  // Real checkout — order DB mein bana kar cart clear karta hai
  const handleCheckout = useCallback(async () => {
    setCheckoutError("");
    const result = await startCheckout(appliedCoupon ? 0 : redeemPoints, appliedCoupon?.code || null);
    if (!result.success) {
      setCheckoutError(result.error || "Checkout start nahi ho saka, dobara try karein.");
    }
    // success ho to yahan kuch nahi karna — user Stripe page par redirect ho chuka hoga
  }, [startCheckout, redeemPoints, appliedCoupon]);

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
                const isPending = pendingIds.has(lineKey(item));
                const fromDeal = !!item.deal_id;
                // NOTE: original_price ab deal-based items ke alawa normal
                // "sale_price" wale products (CategoryPage se) se bhi aa
                // sakti hai — isliye ye check ab fromDeal par depend nahi
                // karta, sirf original_price ki maujoodgi aur price se
                // farq check karta hai.
                const hasOriginalPrice =
                  item.original_price !== null &&
                  item.original_price !== undefined &&
                  Number(item.original_price) !== Number(item.price);

                return (
                  <div
                    key={lineKey(item)}
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
                        {fromDeal && (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#432817] px-2 py-0.5 text-[8px] font-semibold tracking-[0.08em] text-white uppercase">
                            <Tag size={9} strokeWidth={1.8} />
                            {item.deal_name || "Deal"}
                          </span>
                        )}
                        <h3 className="text-xs font-semibold text-[#432817]">
                          {item.name || "Classic Fashion Item"}
                        </h3>
                        <p className="mt-1 flex items-center gap-2 text-xs font-medium text-[#977150]">
                          ${Number(item.price || 0).toLocaleString()}
                          {hasOriginalPrice && (
                            <span className="text-[10px] text-[#8A8177] line-through">
                              ${Number(item.original_price).toLocaleString()}
                            </span>
                          )}
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
                        onClick={() => handleRemove(item)}
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
                {discount > 0 && (
                  <div className="flex justify-between text-[#6B7A5E]">
                    <span>Points discount</span>
                    <span className="font-medium">-${discount.toFixed(2)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-[#6B7A5E]">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span className="font-medium">-${couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-[#D1B79E]/40 pt-3 flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* ---- Coupon code ---- */}
              <div className="mt-4 border-t border-[#D1B79E]/40 pt-4">
                <label className="text-[10px] uppercase tracking-wide text-[#8A8177]">
                  Have a coupon code?
                </label>

                {appliedCoupon ? (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-[#6B7A5E]/40 bg-[#6B7A5E]/10 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#432817]">
                      <Tag size={12} strokeWidth={1.8} />
                      <span className="font-medium">{appliedCoupon.code}</span>
                      {appliedCoupon.description && (
                        <span className="text-[10px] text-[#8A8177]">— {appliedCoupon.description}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[10px] text-[#9B4635] underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value); setCouponError(""); }}
                      placeholder="Enter code"
                      className="w-full rounded-md border border-[#D1B79E] bg-white px-3 py-2 text-xs uppercase outline-none focus:border-[#432817]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponInput.trim()}
                      className="shrink-0 rounded-md bg-[#432817] px-4 py-2 text-[10px] font-medium tracking-wide text-[#EDE6DA] uppercase transition-all hover:bg-[#977150] disabled:opacity-60"
                    >
                      {isValidatingCoupon ? "Checking..." : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && <p className="mt-1.5 text-[10px] text-red-600">{couponError}</p>}
              </div>

              {loyalty?.points > 0 && (
                <div className="mt-4 border-t border-[#D1B79E]/40 pt-4">
                  <div className="flex justify-between text-xs text-[#432817]">
                    <span className="text-[#8A8177]">Your points balance</span>
                    <span className="font-medium">{loyalty.points} pts</span>
                  </div>

                  {appliedCoupon ? (
                    <p className="mt-2 text-[10px] text-[#8A8177]">
                      Coupon applied — remove it to redeem points instead.
                    </p>
                  ) : canRedeem ? (
                    <div className="mt-3">
                      <label className="text-[10px] uppercase tracking-wide text-[#8A8177]">
                        Redeem points (max {maxRedeemable})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={maxRedeemable}
                        value={redeemPoints}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(maxRedeemable, Number(e.target.value) || 0));
                          setRedeemPoints(val);
                        }}
                        className="mt-1 w-full rounded-md border border-[#D1B79E] bg-white px-3 py-2 text-xs outline-none focus:border-[#432817]"
                      />
                      <button
                        type="button"
                        onClick={() => setRedeemPoints(maxRedeemable)}
                        className="mt-1 text-[10px] text-[#977150] underline"
                      >
                        Use max
                      </button>
                    </div>
                  ) : (
                <p className="mt-2 text-[10px] text-[#8A8177]">
  A minimum of {loyalty.settings?.min_redeem_points} points is required to redeem.
</p>
                  )}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={isStartingCheckout}
                className="mt-6 w-full rounded-none bg-[#432817] py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase transition-all hover:bg-[#977150] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isStartingCheckout ? "Redirecting to payment..." : "Proceed to Checkout"}
              </button>

              {checkoutError && (
                <p className="mt-2 text-center text-[10px] text-red-600">{checkoutError}</p>
              )}
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