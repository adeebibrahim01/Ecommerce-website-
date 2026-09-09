import { useCallback, useEffect, useState } from "react";

// Cart Worker Service URL
const API_BASE_URL = "https://cart-worker-service.adeebibrahim01.workers.dev";

/*
|--------------------------------------------------------------------------
| useCart Hook
|--------------------------------------------------------------------------
| Centralized cart management hook with robust error handling and event sync.
|--------------------------------------------------------------------------
*/

export function useCart(userId) {
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Fetch Cart Items & Count
  |--------------------------------------------------------------------------
  */
  const fetchCart = useCallback(async () => {
    if (!userId) {
      setCartCount(0);
      setCartItems([]);
      return [];
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/cart?userId=${encodeURIComponent(userId)}`
      );

      // Check if response is JSON (prevents syntax errors on HTML error pages)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to fetch cart.");
      }

      const items = data.items || data.cart || [];
      setCartItems(items);

      // Calculate total quantity of all items in cart
      const totalQuantity = items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      );

      setCartCount(totalQuantity);
      return items;
    } catch (error) {
      console.error("Failed to fetch cart:", error.message);
      setCartCount(0);
      setCartItems([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /*
  |--------------------------------------------------------------------------
  | Add Item to Cart (Ab name, price aur image bhi bheji ja rahi hain)
  |--------------------------------------------------------------------------
  */
  const addToCart = async (productId, quantity = 1, product = {}) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          productId, 
          quantity,
          name: product.name || product.title || "Unnamed Product",
          price: product.price || 0,
          image: product.image || product.img || product.thumbnail || ""
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        window.dispatchEvent(new Event("cart-change"));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to add to cart:", error);
      return false;
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Remove Item from Cart
  |--------------------------------------------------------------------------
  */
  const removeFromCart = async (productId) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/cart/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, productId }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        window.dispatchEvent(new Event("cart-change"));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to remove item:", error);
      return false;
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Initial Load & Custom Event Sync
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    let isMounted = true;

    if (userId) {
      fetchCart();
    } else {
      setCartCount(0);
      setCartItems([]);
    }

    const handleCartChange = () => {
      if (isMounted) fetchCart();
    };

    window.addEventListener("cart-change", handleCartChange);

    return () => {
      isMounted = false;
      window.removeEventListener("cart-change", handleCartChange);
    };
  }, [userId, fetchCart]);

  return {
    cartCount,
    cartItems,
    isLoading,
    refreshCart: fetchCart,
    addToCart,
    removeFromCart,
  };
}