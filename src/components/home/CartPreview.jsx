import { ShoppingBag } from "lucide-react";

export default function CartPreview({
  cartCount,
  cartItems,
  onNavigate,
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Shopping bag"
        onClick={() => onNavigate("/cart")}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
      >
        <ShoppingBag
          size={17}
          strokeWidth={1.35}
        />

        <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#432817] px-1 text-[7px] font-semibold text-white">
          {cartCount}
        </span>
      </button>

      <div className="invisible absolute top-full right-0 z-50 w-80 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
        <div className="rounded-2xl border border-[#D1B79E]/70 bg-[#F4EEE5]/95 p-3 shadow-[0_18px_50px_rgba(67,40,23,0.14)] backdrop-blur-xl">
          {/* Header */}

          <div className="flex items-center justify-between border-b border-[#D1B79E]/50 px-2 pb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[#432817] uppercase">
                Your Cart
              </p>

              <p className="mt-1 text-[9px] text-[#8A8177]">
                {cartCount} item
                {cartCount !== 1 ? "s" : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate("/cart")
              }
              className="text-[8px] font-semibold tracking-[0.14em] text-[#977150] uppercase transition-colors hover:text-[#432817]"
            >
              View cart
            </button>
          </div>

          {/* Cart Items */}

          <div className="mt-3 max-h-72 overflow-y-auto">
            {cartItems &&
            cartItems.length > 0 ? (
              <div className="space-y-2">
                {cartItems.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#EDE6DA]"
                    >
                      {/* Product Image */}

                      <div className="h-14 w-12 shrink-0 overflow-hidden bg-[#D1B79E]/30">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={
                              item.product_name
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingBag
                              size={13}
                              strokeWidth={
                                1.2
                              }
                              className="text-[#977150]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9px] font-semibold tracking-[0.04em] text-[#432817]">
                          {
                            item.product_name
                          }
                        </p>

                        <p className="mt-1 text-[8px] text-[#8A8177]">
                          Qty:{" "}
                          {
                            item.quantity
                          }
                        </p>
                      </div>

                      {/* Price */}

                      <p className="shrink-0 text-[9px] font-medium text-[#432817]">
                        $
                        {Number(
                          item.price ||
                            0
                        ).toLocaleString()}
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="flex min-h-28 flex-col items-center justify-center text-center">
                <ShoppingBag
                  size={20}
                  strokeWidth={1.2}
                  className="text-[#977150]"
                />

                <p className="mt-3 text-[9px] font-medium tracking-[0.1em] text-[#432817] uppercase">
                  Your cart is empty
                </p>

                <p className="mt-1 text-[8px] text-[#8A8177]">
                  Add something you
                  love.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}