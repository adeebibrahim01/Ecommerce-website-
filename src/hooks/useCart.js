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

      // 🔍 DEBUG FETCH: Check what server returned on initial fetch
      console.log("🔍 [FRONTEND FETCH] Cart fetched from server:", { items, totalQuantity });

      return { items, totalCount: totalQuantity };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  /*
  |--------------------------------------------------------------------------
  | Add Item Mutation (Optimistic Update)
  |--------------------------------------------------------------------------
  */
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity, product }) => {
      const productName = product?.name || product?.title || `Product #${productId}`;
      const productPrice = product?.price !== undefined && product?.price !== null ? Number(product.price) : 0;
      const productImage = product?.image || product?.img || product?.thumbnail || "";
      
      const finalQuantity = Number(quantity) > 0 ? Number(quantity) : 1;

      const payload = {
        userId,
        productId: String(productId),
        quantity: finalQuantity,
        name: productName,
        price: productPrice,
        image: productImage,
      };

      // 🔍 DEBUG ADD PAYLOAD: Check what is actually sent to server
      console.log("🔍 [FRONTEND ADD] Payload being sent to server:", payload);

      const response = await fetch(`${API_BASE_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      
      // 🔍 DEBUG SERVER RESPONSE: Check what server replied with
      console.log("🔍 [FRONTEND ADD] Server response received:", resData);

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to add to cart");
      }
      return resData; 
    },
    onMutate: async ({ productId, quantity, product }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousCart = queryClient.getQueryData(queryKey);

      const productName = product?.name || product?.title || `Product #${productId}`;
      const productPrice = product?.price !== undefined && product?.price !== null ? Number(product.price) : 0;
      const productImage = product?.image || product?.img || product?.thumbnail || "";
      
      const addQty = Number(quantity) > 0 ? Number(quantity) : 1;

      // 🔍 DEBUG OPMITISTIC: Check what quantity is added locally
      console.log("🔍 [FRONTEND OPMITISTIC] Adding quantity locally:", addQty, "for product:", productId);

      queryClient.setQueryData(queryKey, (old = { items: [], totalCount: 0 }) => {
        const items = [...(old.items || [])];
        const existingIndex = items.findIndex(
          (item) => String(item.productId || item.product_id) === String(productId)
        );

        if (existingIndex > -1) {
          items[existingIndex] = {
            ...items[existingIndex],
            quantity: Number(items[existingIndex].quantity || 0) + addQty,
          };
        } else {
          items.push({
            productId: String(productId),
            product_id: String(productId),
            quantity: addQty,
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
      console.error("❌ [FRONTEND ADD ERROR] Failed to add to cart:", err);
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

  const addToCart = async (productId, quantity = 1, product = {}) => {
    if (!userId || !productId) return false;
    
    // 🔍 DEBUG CALLER: Check where addToCart is called from and what quantity is passed
    console.log("🔍 [FRONTEND CALLER] addToCart invoked with:", { productId, quantity });

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

  return {
    cartCount: data.totalCount,
    cartItems: data.items,
    isLoading,
    refreshCart: refetch,
    addToCart,
    removeFromCart,
  };
}