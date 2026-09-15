import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw, PackageSearch } from "lucide-react";

import ProductCard from "./ProductCard";
import { useCart } from "../../hooks/useCart";
import { useAuth } from "../../hooks/useAuth";
import {
    DEALS_API_URL,
    computeDiscountedPrice,
    formatMoney,
    resolveDealProducts,
} from "../../utils/deals";

function ProductCardSkeleton() {
    return (
        <div>
            <div className="aurelia-shimmer aspect-[3/4] w-full overflow-hidden" />
            <div className="pt-4">
                <div className="aurelia-shimmer mb-3 h-2.5 w-14 rounded-full" />
                <div className="flex items-start justify-between gap-4">
                    <div className="aurelia-shimmer h-3 w-28 rounded-full" />
                    <div className="aurelia-shimmer h-3 w-10 shrink-0 rounded-full" />
                </div>
            </div>
        </div>
    );
}

export default function DealDetailPage({ userId: userIdProp }) {
    const { id } = useParams();
    const { user } = useAuth();
    const userId = userIdProp || user?.id;
    const { cartItems, addToCart, isLoading: isCartLoading } = useCart(userId);

    const [status, setStatus] = useState("loading"); // loading | ready | error | not-found
    const [error, setError] = useState("");
    const [deal, setDeal] = useState(null);
    const [products, setProducts] = useState([]);
    const [reloadToken, setReloadToken] = useState(0);
    const slugCacheRef = useRef(new Map());

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        async function load() {
            setStatus("loading");
            setError("");

            try {
                const res = await fetch(`${DEALS_API_URL}/deals/${id}`, { signal: controller.signal });
                if (res.status === 404) {
                    if (!cancelled) setStatus("not-found");
                    return;
                }
                if (!res.ok) throw new Error(`Failed to load deal (status ${res.status})`);

                const data = await res.json();
                if (!data?.success) throw new Error(data?.message || "Failed to load deal.");

                if (cancelled) return;
                setDeal(data.deal);

                const resolved = await resolveDealProducts(data.deal, slugCacheRef.current, controller.signal);
                if (!cancelled) {
                    setProducts(resolved);
                    setStatus("ready");
                }
            } catch (err) {
                if (cancelled || err.name === "AbortError") return;
                console.error("Deal detail load error:", err);
                setError(err.message || "Failed to load deal.");
                setStatus("error");
            }
        }

        load();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [id, reloadToken]);

    const handleAddToCart = async (product) => {
        if (!userId) {
            alert("Please log in to add items to cart.");
            return;
        }
        if (!product?.id) return;

        await addToCart(product.id, 1, {
            name: product.name,
            price: product.price,          // discounted price
            image: product.image,
            dealId: deal.id,                // NEW
            dealName: deal.name,             // NEW
            originalPrice: Number(product.originalPrice ?? product.price), // NEW
        });
    };

    const isProductInCart = (productId) => {
        if (!cartItems) return false;
        return cartItems.some(
            (item) => String(item.product_id || item.productId) === String(productId)
        );
    };

    return (
        <section className="relative overflow-hidden bg-[#EDE6DA]">
            <style>{`
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
        @keyframes aurelia-shimmer-sweep {
          0% { background-position: -300% 0; }
          100% { background-position: 300% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurelia-shimmer { animation: none; background-image: none; }
        }
      `}</style>

            <div className="relative mx-auto max-w-[1600px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16 xl:px-16">
                <Link
                    to="/deals"
                    className="mb-8 inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-[#8A8177] uppercase transition-colors hover:text-[#432817]"
                >
                    <ArrowLeft size={13} strokeWidth={1.8} />
                    Back to deals
                </Link>

                {status === "loading" && (
                    <>
                        <div className="aurelia-shimmer mb-10 h-56 w-full rounded-[2rem] sm:h-72" />
                        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <ProductCardSkeleton key={i} />
                            ))}
                        </div>
                    </>
                )}

                {(status === "error" || status === "not-found") && (
                    <div className="flex min-h-[460px] items-center justify-center">
                        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#D8CFC2] bg-white/25 px-6 py-16 text-center shadow-[0_20px_60px_rgba(67,40,23,0.04)] backdrop-blur-sm sm:px-12">
                            <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-[#EDE6DA]">
                                {status === "not-found" ? (
                                    <PackageSearch size={20} strokeWidth={1.3} className="text-[#432817]" />
                                ) : (
                                    <RotateCcw size={20} strokeWidth={1.3} className="text-[#432817]" />
                                )}
                            </div>
                            <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                                {status === "not-found" ? "Deal not found" : "Couldn't load this deal"}
                            </h3>
                            {status === "error" && (
                                <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">{error}</p>
                            )}
                            {status === "error" && (
                                <button
                                    type="button"
                                    onClick={() => setReloadToken((n) => n + 1)}
                                    className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-[#432817] bg-[#432817] px-7 py-3 text-[9px] font-semibold tracking-[0.18em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
                                >
                                    <RotateCcw size={12} strokeWidth={1.8} />
                                    Try again
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {status === "ready" && deal && (
                    <>
                        {/* Banner */}
                        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-[#D8CFC2] sm:mb-12">
                            <div className="relative h-56 w-full sm:h-72 lg:h-80">
                                {deal.image ? (
                                    <img
                                        src={deal.image}
                                        alt={deal.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full bg-[#D1B79E]" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#432817]/80 via-[#432817]/20 to-transparent" />
                            </div>
                            <div className="absolute bottom-0 left-0 p-6 sm:p-10">
                                <span className="mb-3 inline-block rounded-full bg-white px-3 py-1.5 text-[9px] font-semibold tracking-[0.1em] text-[#432817]">
                                    {deal.label}
                                </span>
                                <h1 className="font-serif text-3xl leading-tight tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl">
                                    {deal.name}
                                </h1>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="mb-6 flex items-center justify-between border-b border-[#D8CFC2]/60 pb-5">
                            <p className="text-[10px] tracking-[0.14em] text-[#8A8177] uppercase">
                                {products.length} {products.length === 1 ? "piece" : "pieces"} in this deal
                            </p>
                        </div>

                        {products.length === 0 ? (
                            <p className="text-xs text-[#7E7E86]">No products currently match this deal.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-16 xl:grid-cols-4 xl:gap-x-7">
                                {products.map((product) => {
                                    const originalPrice = Number(product.price);
                                    const discountedPrice = computeDiscountedPrice(
                                        product.price,
                                        deal.value,
                                        deal.type
                                    );
                                    const hasDiscount =
                                        Number.isFinite(originalPrice) &&
                                        Number.isFinite(discountedPrice) &&
                                        discountedPrice !== originalPrice;
                                    const cardProduct = hasDiscount
                                        ? { ...product, price: discountedPrice, originalPrice }
                                        : product;

                                    return (
                                        <div key={product.id} className="group min-w-0">
                                            <ProductCard
                                                id={cardProduct.id}
                                                name={cardProduct.name}
                                                price={cardProduct.price}
                                                image={cardProduct.image}
                                                category={cardProduct.type}
                                                badge={hasDiscount ? `Was ${formatMoney(originalPrice)}` : cardProduct.badge}
                                                isInCart={isProductInCart(cardProduct.id)}
                                                onAddToCart={() => handleAddToCart(cardProduct)}
                                                isCartLoading={isCartLoading}
                                                dealId={deal.id}
                                                dealName={deal.name}
                                                originalPrice={originalPrice}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}