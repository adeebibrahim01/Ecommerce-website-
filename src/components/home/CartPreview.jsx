import React, { useMemo } from "react";
import { ShoppingBag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CartPreview({
  cartCount = 0,
  cartItems = [],
  onNavigate,
  onRemoveItem,
}) {
  const navigate = useNavigate();
  const hasItems = Array.isArray(cartItems) && cartItems.length > 0;

  // useMemo lagane se yeh bar bar calculate nahi hoga, jisse thora flicker kam ho sakta hai
  const calculatedTotalCount = useMemo(() => {
    return hasItems
      ? cartItems.reduce((total, item) => total + Number(item.quantity || 0), 0)
      : Number(cartCount) || 0;
  }, [cartItems, cartCount, hasItems]);

  // Safe navigation handler
  const handleCartClick = () => {
    if (onNavigate) {
      onNavigate("/cart");
    } else {
      navigate("/cart");
    }
  };

  const handleDelete = (e, item) => {
    e.stopPropagation();
    const targetId = item.productId || item.product_id || item.id;
    if (onRemoveItem && targetId) {
      onRemoveItem(targetId);
    }
  };

  return (
    <div className="group relative">
      {/* Cart Trigger Button */}
      <button
        type="button"
        aria-label="Shopping bag"
        onClick={handleCartClick}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
      >
        <ShoppingBag size={17} strokeWidth={1.35} />

        {calculatedTotalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] font-semibold text-white">
            {calculatedTotalCount}
          </span>
        )}
      </button>

      {/* Dropdown Box */}
      <div className="invisible absolute top-full right-0 z-50 w-80 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
        <div className="rounded-2xl border border-[#D1B79E]/70 bg-[#F4EEE5]/95 p-3 shadow-[0_18px_50px_rgba(67,40,23,0.14)] backdrop-blur-xl">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#D1B79E]/50 px-2 pb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[#432817] uppercase">
                Your Cart
              </p>
              <p className="mt-1 text-[9px] text-[#8A8177]">
                {calculatedTotalCount} item{calculatedTotalCount !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCartClick}
              className="text-[8px] font-semibold tracking-[0.14em] text-[#977150] uppercase transition-colors hover:text-[#432817]"
            >
              View cart
            </button>
          </div>

          {/* Cart Items List */}
          <div className="mt-3 max-h-72 overflow-y-auto pr-1">
            {hasItems ? (
              <div className="space-y-2">
                {cartItems.map((item, index) => {
                  const itemId = item.productId || item.product_id || item.id;
                  return (
                    <div
                      key={itemId || index}
                      className="group/item flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#EDE6DA]"
                    >
                      {/* Product Image */}
                      <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-[#D1B79E]/30">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name || "Product"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingBag size={13} strokeWidth={1.2} className="text-[#977150]" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9px] font-semibold tracking-[0.04em] text-[#432817]">
                          {item.name || item.product_name || "Unnamed Product"}
                        </p>
                        <p className="mt-1 text-[8px] text-[#8A8177]">
                          Qty: {item.quantity || 1}
                        </p>
                      </div>

                      {/* Price & Delete Button */}
                      <div className="flex items-center gap-2">
                        <p className="shrink-0 text-[9px] font-medium text-[#432817]">
                          ${Number(item.price || 0).toLocaleString()}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8A8177] transition-colors hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 size={13} strokeWidth={1.4} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="flex min-h-28 flex-col items-center justify-center text-center">
                <ShoppingBag size={20} strokeWidth={1.2} className="text-[#977150]" />
                <p className="mt-3 text-[9px] font-medium tracking-[0.1em] text-[#432817] uppercase">
                  Your cart is empty
                </p>
                <p className="mt-1 text-[8px] text-[#8A8177]">
                  Add something you love.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}