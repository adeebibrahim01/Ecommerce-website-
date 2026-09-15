import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, RotateCcw, Tag } from "lucide-react";

import ProductCard from "../components/shop/ProductCard";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";

function ShimmerBlock({ className = "" }) {
    return <div className={`aurelia-shimmer ${className}`} />;
}

function ProductCardSkeleton() {
    return (
        <div>
            <ShimmerBlock className="aspect-[3/4] w-full overflow-hidden" />
            <div className="pt-4">
                <ShimmerBlock className="mb-3 h-2.5 w-14 rounded-full" />
                <div className="flex items-start justify-between gap-4">
                    <ShimmerBlock className="h-3 w-28 rounded-full" />
                    <ShimmerBlock className="h-3 w-10 shrink-0 rounded-full" />
                </div>
            </div>
        </div>
    );
}

const SKELETON_COUNT = 8;

export default function WishlistPage({ userId: userIdProp }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = userIdProp || user?.id || user?._id || user?.sub || user?.email;

    const { wishlistItems, isLoading, removeFromWishlist } = useWishlist(userId);
    const { cartItems, addToCart, isLoading: isCartLoading } = useCart(userId);

    // ProductCard "price" prop ko number expect karta hai (sale_price > price)
    // — CategoryPage.jsx ke normalizeProduct wale exact logic se match karke
    // taake formatting/price dono jagah same rahe.
    // NEW: deal_id/deal_name bhi carry karte hain (backend se GET /wishlist
    // ke through aate hain agar item deal se add hua tha).
    // NEW: original_price bhi carry karte hain — backend ab deal wale items
    // ke liye original_price/sale_price compute karke bhejta hai, isse
    // ProductCard apna strikethrough (originalPrice prop) render kar sake.
    const normalizedItems = useMemo(() => {
        return (wishlistItems || []).map((row) => ({
            id: row.id,
            name: row.name,
            price: row.sale_price ?? row.price,
            image: row.image,
            type: row.type,
            badge: row.badge,
            dealId: row.deal_id ?? null,          // NEW
            dealName: row.deal_name ?? null,       // NEW
            originalPrice: row.original_price ?? null, // NEW
        }));
    }, [wishlistItems]);

    const isProductInCart = (productId) => {
        if (!cartItems) return false;
        return cartItems.some(
            (item) => String(item.product_id || item.productId) === String(productId)
        );
    };

    const handleAddToCart = async (product) => {
        if (!userId) {
            navigate("/login");
            return;
        }
        const success = await addToCart(product.id, 1, {
            name: product.name,
            price: product.price,
            image: product.image,
            dealId: product.dealId,
            dealName: product.dealName,
            originalPrice: product.originalPrice ?? null,   // FIX: ye line add karo
        });
        if (success) {
            await removeFromWishlist(product.id);
        }
    };

    return (
        <section className="relative overflow-hidden bg-[#EDE6DA]">
            <style>{`
        @keyframes aurelia-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .aurelia-grid-item {
          animation: aurelia-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--aurelia-delay, 0ms);
        }

        @keyframes aurelia-shimmer-sweep {
          0% { background-position: -300% 0; }
          100% { background-position: 300% 0; }
        }
        .aurelia-shimmer {
          background-color: rgba(209, 183, 158, 0.28);
          background-image: linear-gradient(
            100deg,
            rgba(209, 183, 158, 0.28) 30%,
            rgba(255, 255, 255, 0.65) 50%,
            rgba(209, 183, 158, 0.28) 70%
          );
          background-size: 300% 100%;
          animation: aurelia-shimmer-sweep 1.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurelia-grid-item { animation: none; }
          .aurelia-shimmer { animation: none; background-image: none; }
        }
      `}</style>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/25 to-transparent" />

            <div className="relative border-y border-[#D8CFC2]/80 bg-[#EDE6DA]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12 xl:px-16">
                    <div className="flex min-h-[76px] items-center justify-between gap-6">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#CFC4B5] bg-white/30">
                                    <Heart size={15} strokeWidth={1.5} className="text-[#432817]" />
                                </div>
                                <span className="text-[10px] font-semibold tracking-[0.2em] text-[#432817] uppercase">
                                    Wishlist
                                </span>
                            </div>

                            <div className="hidden h-7 w-px bg-[#CFC4B5] sm:block" />
                        </div>

                        <div className="hidden shrink-0 items-center gap-3 md:flex">
                            <span className="text-[10px] tracking-[0.16em] text-[#8A8177] uppercase">
                                Saved Edit
                            </span>

                            {isLoading ? (
                                <ShimmerBlock className="h-8 w-8 rounded-full" />
                            ) : (
                                <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[#CFC4B5] bg-white/35 px-2 text-[10px] font-semibold text-[#432817] shadow-[inset_0_1px_2px_rgba(67,40,23,0.06)]">
                                    {normalizedItems.length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative mx-auto max-w-[1600px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16 xl:px-16">
                {isLoading ? (
                    <>
                        <div className="mb-9 flex items-end justify-between gap-6 lg:mb-12">
                            <div>
                                <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                                    Your saved pieces
                                </p>
                                <ShimmerBlock className="h-9 w-56 rounded-md sm:h-10" />
                            </div>
                            <div className="hidden h-px flex-1 bg-[#D8CFC2] sm:block" />
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
                            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                                <ProductCardSkeleton key={i} />
                            ))}
                        </div>
                    </>
                ) : normalizedItems.length > 0 ? (
                    <>
                        <div className="mb-9 flex items-end justify-between gap-6 lg:mb-12">
                            <div>
                                <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                                    Your saved pieces
                                </p>
                                <h2 className="font-serif text-3xl leading-none tracking-[-0.02em] text-[#432817] sm:text-4xl lg:text-[2.75rem]">
                                    Wishlist
                                </h2>
                            </div>
                            <div className="hidden h-px flex-1 bg-gradient-to-r from-[#D8CFC2] to-transparent sm:block" />
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
                            {normalizedItems.map((product, index) => {
                                const fromDeal = !!product.dealId;

                                return (
                                    <div
                                        key={product.id}
                                        className="aurelia-grid-item group relative min-w-0"
                                        style={{ "--aurelia-delay": `${Math.min(index * 45, 360)}ms` }}
                                    >
                                        {fromDeal && (
                                            <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-[#432817] px-2.5 py-1 text-[8px] font-semibold tracking-[0.08em] text-white uppercase">
                                                <Tag size={9} strokeWidth={1.8} />
                                                {product.dealName || "Deal"}
                                            </span>
                                        )}
                                        <ProductCard
                                            id={product.id}
                                            name={product.name}
                                            price={product.price}
                                            image={product.image}
                                            category={product.type}
                                            badge={product.badge}
                                            isInCart={isProductInCart(product.id)}
                                            onAddToCart={() => handleAddToCart(product)}
                                            isCartLoading={isCartLoading}
                                            dealId={product.dealId}
                                            dealName={product.dealName}
                                            originalPrice={product.originalPrice}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-[460px] items-center justify-center">
                        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#D8CFC2] bg-white/25 px-6 py-16 text-center shadow-[0_20px_60px_rgba(67,40,23,0.04)] backdrop-blur-sm sm:px-12">
                            <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-[#EDE6DA]">
                                <Heart size={20} strokeWidth={1.3} className="text-[#432817]" />
                            </div>

                            <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                                Nothing here yet
                            </p>

                            <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                                Your wishlist is empty
                            </h3>

                            <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">
                                Tap the heart icon on any product to save it here for later.
                            </p>

                            <button
                                type="button"
                                onClick={() => navigate("/")}
                                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-[#432817] bg-[#432817] px-7 py-3 text-[9px] font-semibold tracking-[0.18em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
                            >
                                <RotateCcw size={12} strokeWidth={1.8} />
                                Start Shopping
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}