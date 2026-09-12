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
        mutationFn: async ({ productId }) => {
            const response = await fetch(`${API_BASE_URL}/wishlist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, product_id: productId }),
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


                const items = [...(old.items || []), { id: productId, ...product }];
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
        // NOTE: yahan invalidateQueries NAHI karna — optimistic cache hi
        // final state hai, refetch se purana/incomplete data wapas aakar
        // optimistic add ko overwrite kar deta tha (yehi disappearing bug tha).
        onSuccess: () => {
            window.dispatchEvent(new Event("wishlist-change"));
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