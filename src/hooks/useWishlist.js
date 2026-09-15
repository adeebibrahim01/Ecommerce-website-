import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";

export function useWishlist(userId) {
    const queryClient = useQueryClient();
    const queryKey = ["wishlist", userId];

    const {
        data = { items: [], totalCount: 0 },
        isLoading,
        refetch,
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!userId) return { items: [], totalCount: 0 };

            const response = await fetch(
                `${API_BASE_URL}/wishlist?user_id=${encodeURIComponent(userId)}&_t=${Date.now()}`,
                { cache: "no-store" }
            );

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
            }

            const resData = await response.json();
            if (!response.ok || !resData.success) {
                throw new Error(resData.message || "Failed to fetch wishlist.");
            }


            const items = resData.wishlist || [];
            return { items, totalCount: items.length };
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    const addToWishlistMutation = useMutation({
        mutationFn: async ({ productId, product }) => {
            // FIX: product object (dealId/dealName sameyt) pehle yahan
            // bheja hi nahi ja raha tha — sirf onMutate (optimistic UI)
            // mein use ho raha tha. Isliye deal info backend tak kabhi
            // pahunchti nahi thi aur refetch ke baad gayab ho jati thi.
            const response = await fetch(`${API_BASE_URL}/wishlist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    product_id: productId,
                    deal_id: product?.dealId ?? null,
                    deal_name: product?.dealName ?? null,
                }),
            });

            const resData = await response.json();
            if (!response.ok || !resData.success) {
                throw new Error(resData.message || "Failed to add to wishlist");
            }
            return resData;
        },
        onMutate: async ({ productId, product }) => {
            await queryClient.cancelQueries({ queryKey });
            const previousWishlist = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old = { items: [], totalCount: 0 }) => {
                const alreadyExists = (old.items || []).some(
                    (item) => String(item.id) === String(productId)
                );
                if (alreadyExists) return old;

                // NOTE: product.dealId/dealName -> optimistic item mein
                // deal_id/deal_name naam se store karo, taake ye backend
                // se aane wali GET /wishlist shape se match ho.
                const items = [
                    ...(old.items || []),
                    {
                        id: productId,
                        ...product,
                        deal_id: product?.dealId ?? null,
                        deal_name: product?.dealName ?? null,
                    },
                ];
                return { items, totalCount: items.length };
            });

            return { previousWishlist };
        },
        onError: (err, variables, context) => {
            if (context?.previousWishlist) {
                queryClient.setQueryData(queryKey, context.previousWishlist);
            }
            console.error("❌ [WISHLIST ADD ERROR]:", err);
        },
        onSuccess: () => {
            window.dispatchEvent(new Event("wishlist-change"));

            // FIX: optimistic item mein sirf deal_id/deal_name hote hain —
            // original_price/sale_price (deal discount se) sirf backend ke
            // GET /wishlist route pe compute hoti hai. Isliye add hone ke
            // baad ek silent background refetch zaroori hai, warna
            // strikethrough price tab tak nahi dikhti jab tak page hard
            // refresh na ho. Ye refetch chupke se background mein hota hai,
            // UI turant optimistic item dikha hi chuki hoti hai isliye
            // koi flicker/disappearing nahi hota (jo purani problem thi
            // wo backend ke incomplete response ki wajah se thi, ab
            // backend original_price/sale_price sahi bhejta hai).
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const removeFromWishlistMutation = useMutation({
        mutationFn: async (productId) => {
            const response = await fetch(
                `${API_BASE_URL}/wishlist/${productId}?user_id=${encodeURIComponent(userId)}`,
                { method: "DELETE" }
            );

            const resData = await response.json();
            if (!response.ok || !resData.success) {
                throw new Error(resData.message || "Failed to remove from wishlist");
            }
            return resData;

        },
        onMutate: async (productId) => {
            await queryClient.cancelQueries({ queryKey });
            const previousWishlist = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old = { items: [], totalCount: 0 }) => {
                const items = (old.items || []).filter(
                    (item) => String(item.id) !== String(productId)
                );
                return { items, totalCount: items.length };
            });

            return { previousWishlist };
        },
        onError: (err, productId, context) => {
            if (context?.previousWishlist) {
                queryClient.setQueryData(queryKey, context.previousWishlist);
            }
            console.error("❌ [WISHLIST REMOVE ERROR]:", err);
        },
        onSuccess: () => {
            window.dispatchEvent(new Event("wishlist-change"));
            // Consistency ke liye yahan bhi background refetch — remove ke
            // baad server state se sync rehne ke liye.
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const isInWishlist = (productId) =>
        (data.items || []).some((item) => String(item.id) === String(productId));

    const addToWishlist = async (productId, product = {}) => {
        if (!userId || !productId) return false;
        try {
            await addToWishlistMutation.mutateAsync({ productId, product });

            return true;
        } catch {
            return false;
        }
    };

    const removeFromWishlist = async (productId) => {
        if (!userId || !productId) return false;
        try {
            await removeFromWishlistMutation.mutateAsync(productId);
            return true;
        } catch {
            return false;
        }
    };

    const toggleWishlist = async (productId, product = {}) => {
        return isInWishlist(productId)
            ? removeFromWishlist(productId)
            : addToWishlist(productId, product);
    };

    return {
        wishlistCount: data.totalCount,
        wishlistItems: data.items,
        isLoading,
        refreshWishlist: refetch,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isMutating: addToWishlistMutation.isPending || removeFromWishlistMutation.isPending,

    };
}