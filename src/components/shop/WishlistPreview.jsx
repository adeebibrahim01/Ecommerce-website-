import React, { useMemo } from "react";
import { Heart, ShoppingBag, Trash2, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WishlistPreview({
    wishlistCount = 0,
    wishlistItems = [],
    onNavigate,
    onRemoveItem,   // wishlist se remove karne ke liye
    onAddToCart,    // item ko cart mein daalne ke liye (aur wishlist se hataane ke liye)
    isAdding,       // { [productId]: true } — kaunsa item add ho raha hai
}) {
    const navigate = useNavigate();
    const hasItems = Array.isArray(wishlistItems) && wishlistItems.length > 0;

    const calculatedTotalCount = useMemo(() => {
        return hasItems ? wishlistItems.length : Number(wishlistCount) || 0;
    }, [wishlistItems, wishlistCount, hasItems]);

    const handleWishlistClick = () => {
        if (onNavigate) onNavigate("/wishlist");
        else navigate("/wishlist");
    };

    const handleDelete = (e, item) => {
        e.stopPropagation();
        if (onRemoveItem && item.id) {
            onRemoveItem(item.id);
        }
    };

    const handleAddToCart = (e, item) => {
        e.stopPropagation();
        if (onAddToCart) {
            onAddToCart(item);
        }
    };

    return (
        <div className="group relative">
            {/* Wishlist Trigger Button */}
            <button
                type="button"
                aria-label="Wishlist"
                onClick={handleWishlistClick}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#432817] transition-all duration-300 hover:bg-white/45 hover:text-[#977150]"
            >
                <Heart size={17} strokeWidth={1.35} />

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
                                Your Wishlist
                            </p>
                            <p className="mt-1 text-[9px] text-[#8A8177]">
                                {calculatedTotalCount} item{calculatedTotalCount !== 1 ? "s" : ""}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleWishlistClick}
                            className="text-[8px] font-semibold tracking-[0.14em] text-[#977150] uppercase transition-colors hover:text-[#432817]"
                        >
                            View all
                        </button>
                    </div>

                    {/* Wishlist Items List */}
                    <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                        {hasItems ? (
                            <div className="space-y-2">
                                {wishlistItems.map((item, index) => {
                                    // displayPrice = wohi price jo customer abhi pay karega.
                                    // Deal/sale wale items mein asal (discounted) amount
                                    // sale_price mein hoti hai — price field original
                                    // amount rakhta hai, isliye sirf item.price se
                                    // compare karne par original_price hamesha price
                                    // ke barabar nikalta hai aur strikethrough kabhi
                                    // nahi chalta. Isliye sale_price ko priority dena
                                    // zaroori hai.
                                    const displayPrice = item.sale_price ?? item.price;
                                    const itemIsAdding = isAdding?.[item.id];
                                    const fromDeal = !!item.deal_id;
                                    // NOTE: original_price ab deal-based items ke alawa
                                    // normal "sale_price" wale products (CategoryPage se) se
                                    // bhi aa sakti hai — isliye ye check ab fromDeal par
                                    // depend nahi karta, sirf original_price ki maujoodgi
                                    // aur displayPrice se farq check karta hai.
                                    const hasOriginalPrice =
                                        item.original_price !== null &&
                                        item.original_price !== undefined &&
                                        Number(item.original_price) !== Number(displayPrice);

                                    return (
                                        <div
                                            key={item.id || index}
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
                                                        <Heart size={13} strokeWidth={1.2} className="text-[#977150]" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Product Info */}
                                            <div className="min-w-0 flex-1">
                                                {fromDeal && (
                                                    <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-[#432817] px-1.5 py-0.5 text-[7px] font-semibold tracking-[0.06em] text-white uppercase">
                                                        <Tag size={8} strokeWidth={1.8} />
                                                        {item.deal_name || "Deal"}
                                                    </span>
                                                )}
                                                <p className="truncate text-[9px] font-semibold tracking-[0.04em] text-[#432817]">
                                                    {item.name || "Unnamed Product"}
                                                </p>
                                                {displayPrice != null && (
                                                    <p className="mt-1 flex items-center gap-1.5 text-[8px] text-[#8A8177]">
                                                        <span className="font-medium text-[#977150]">
                                                            ${Number(displayPrice).toLocaleString()}
                                                        </span>
                                                        {hasOriginalPrice && (
                                                            <span className="text-[7px] text-[#8A8177] line-through">
                                                                ${Number(item.original_price).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Add to Cart & Delete */}
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleAddToCart(e, item)}
                                                    disabled={itemIsAdding}
                                                    aria-label="Add to cart"
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#432817] transition-colors hover:bg-[#432817] hover:text-white disabled:opacity-50"
                                                >
                                                    <ShoppingBag size={13} strokeWidth={1.4} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, item)}
                                                    aria-label="Remove from wishlist"
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
                                <Heart size={20} strokeWidth={1.2} className="text-[#977150]" />
                                <p className="mt-3 text-[9px] font-medium tracking-[0.1em] text-[#432817] uppercase">
                                    Your wishlist is empty
                                </p>
                                <p className="mt-1 text-[8px] text-[#8A8177]">
                                    Tap the heart on any product.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}