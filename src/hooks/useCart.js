import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Cart Worker Service URL
const API_BASE_URL = "https://cart-worker-service.adeebibrahim01.workers.dev";

export function useCart(userId) {
  const queryClient = useQueryClient();
  const queryKey = ["cart", userId];

  /*
  |--------------------------------------------------------------------------
  | Fetch Cart Query
  |--------------------------------------------------------------------------
  */
  const {
    data = { items: [], totalCount: 0 },
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return { items: [], totalCount: 0 };

      const response = await fetch(
        `${API_BASE_URL}/cart?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
      }

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || resData.message || "Failed to fetch cart.");
      }

      const items = resData.items || resData.cart || [];
      const totalQuantity = items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      );

      return { items, totalCount: totalQuantity };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  /*
  |--------------------------------------------------------------------------
  | Add/Update Item Mutation (Optimistic Update)
  |--------------------------------------------------------------------------
  | NOTE: `quantity` is treated as a DELTA (can be positive to add or
  | negative to decrease) - it matches the worker's SQL which does
  | `quantity = cart.quantity + excluded.quantity`. Only 0/undefined/NaN
  | falls back to 1.
  |--------------------------------------------------------------------------
  */
  const resolveDelta = (quantity) => {
    const raw = Number(quantity);
    return Number.isFinite(raw) && raw !== 0 ? raw : 1;
  };

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity, product }) => {
      const productName = product?.name || product?.title || `Product #${productId}`;
      const productPrice = product?.price !== undefined && product?.price !== null ? Number(product.price) : 0;
      const productImage = product?.image || product?.img || product?.thumbnail || "";

      const finalQuantity = resolveDelta(quantity);

      const payload = {
        userId,
        productId: String(productId),
        quantity: finalQuantity,
        name: productName,
        price: productPrice,
        image: productImage,
      };

      const response = await fetch(`${API_BASE_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to update cart");
      }
      return resData;
    },
    onMutate: async ({ productId, quantity, product }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousCart = queryClient.getQueryData(queryKey);

      const productName = product?.name || product?.title || `Product #${productId}`;
      const productPrice = product?.price !== undefined && product?.price !== null ? Number(product.price) : 0;
      const productImage = product?.image || product?.img || product?.thumbnail || "";

      const delta = resolveDelta(quantity);

      queryClient.setQueryData(queryKey, (old = { items: [], totalCount: 0 }) => {
        const items = [...(old.items || [])];
        const existingIndex = items.findIndex(
          (item) => String(item.productId || item.product_id) === String(productId)
        );

        if (existingIndex > -1) {
          const newQty = Math.max(
            0,
            Number(items[existingIndex].quantity || 0) + delta
          );
          items[existingIndex] = {
            ...items[existingIndex],
            quantity: newQty,
          };
        } else if (delta > 0) {
          items.push({
            productId: String(productId),
            product_id: String(productId),
            quantity: delta,
            name: productName,
            price: productPrice,
            image: productImage,
          });
        }

        const totalQuantity = items.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        );

        return { items, totalCount: totalQuantity };
      });

      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(queryKey, context.previousCart);
      }
      console.error("❌ [FRONTEND ADD ERROR] Failed to update cart:", err);
    },
    onSuccess: (serverData) => {
      const items = serverData.items || serverData.cart;
      if (items) {
        const totalQuantity = items.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        );
        queryClient.setQueryData(queryKey, { items, totalCount: totalQuantity });
      }
      window.dispatchEvent(new Event("cart-change"));
    },
  });

  /*
  |--------------------------------------------------------------------------
  | Remove Item Mutation
  |--------------------------------------------------------------------------
  */
  const removeFromCartMutation = useMutation({
    mutationFn: async (productId) => {
      const response = await fetch(`${API_BASE_URL}/cart/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, productId: String(productId) }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to remove item");
      }
      return resData;
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousCart = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old = { items: [], totalCount: 0 }) => {
        const items = (old.items || []).filter(
          (item) => String(item.productId || item.product_id) !== String(productId)
        );

        const totalQuantity = items.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        );

        return { items, totalCount: totalQuantity };
      });

      return { previousCart };
    },
    onError: (err, productId, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(queryKey, context.previousCart);
      }
      console.error("❌ [FRONTEND REMOVE ERROR] Failed to remove item:", err);
    },
    onSuccess: (serverData) => {
      const items = serverData.items || serverData.cart;
      if (items) {
        const totalQuantity = items.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        );
        queryClient.setQueryData(queryKey, { items, totalCount: totalQuantity });
      }
      window.dispatchEvent(new Event("cart-change"));
    },
  });

  /*
  |--------------------------------------------------------------------------
  | Stripe Checkout — Stripe ke hosted page ka session banata hai
  |--------------------------------------------------------------------------
  */
  const createCheckoutSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          successUrl: `${window.location.origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/cart`,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to start checkout");
      }
      return resData;
    },
  });

  // ---- Plain async wrapper functions (return se PEHLE define hone zaroori hain) ----

  // quantity: pass a positive number to add, a negative number to decrease.
  const addToCart = async (productId, quantity = 1, product = {}) => {
    if (!userId || !productId) return false;

    try {
      await addToCartMutation.mutateAsync({ productId, quantity, product });
      return true;
    } catch {
      return false;
    }
  };

  const removeFromCart = async (productId) => {
    if (!userId || !productId) return false;
    try {
      await removeFromCartMutation.mutateAsync(productId);
      return true;
    } catch {
      return false;
    }
  };

  // Isse call karne par user Stripe ki page par redirect ho jayega.
  // Order webhook se banega jab payment successful ho jayegi.
  const startCheckout = async () => {
    if (!userId) return { success: false, error: "Please log in first." };
    try {
      const result = await createCheckoutSessionMutation.mutateAsync();
      window.location.href = result.url; // Stripe checkout page
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ---- Ek hi return statement ----
  return {
    cartCount: data.totalCount,
    cartItems: data.items,
    isLoading,
    refreshCart: refetch,
    addToCart,
    removeFromCart,
    startCheckout,
    isStartingCheckout: createCheckoutSessionMutation.isPending,
    isMutating: addToCartMutation.isPending || removeFromCartMutation.isPending,
  };
}