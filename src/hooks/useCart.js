import { useCallback, useEffect, useState } from "react";

const CART_API_URL =
  "https://aurelia-cart-worker.adeebibrahim01.workers.dev/api/cart";

/*
|--------------------------------------------------------------------------
| useCart
|--------------------------------------------------------------------------
| Central Cart functionality
|
| Is hook ko kisi bhi component mein directly use kar sakte hain:
|
| const {
|   cartCount,
|   cartItems,
|   refreshCart,
| } = useCart(userId);
|
|--------------------------------------------------------------------------
*/

export function useCart(userId) {
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState([]);

  /*
  |--------------------------------------------------------------------------
  | Fetch Cart
  |--------------------------------------------------------------------------
  */

  const fetchCart = useCallback(async () => {
    if (!userId) {
      setCartCount(0);
      setCartItems([]);

      return [];
    }

    try {
      const response = await fetch(
        `${CART_API_URL}?userId=${encodeURIComponent(userId)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to fetch cart."
        );
      }

      const items = data.items || [];

      /*
      |--------------------------------------------------------------------------
      | Store Cart Items
      |--------------------------------------------------------------------------
      */

      setCartItems(items);

      /*
      |--------------------------------------------------------------------------
      | Total Quantity
      |--------------------------------------------------------------------------
      |
      | Example:
      |
      | Product A = 2
      | Product B = 3
      |
      | cartCount = 5
      |
      |--------------------------------------------------------------------------
      */

      const totalQuantity = items.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );

      setCartCount(totalQuantity);

      return items;
    } catch (error) {
      console.error(
        "Failed to fetch cart:",
        error
      );

      setCartCount(0);
      setCartItems([]);

      return [];
    }
  }, [userId]);

  /*
  |--------------------------------------------------------------------------
  | Initial Cart Fetch
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    const loadCart = async () => {
      if (!userId) {
        if (!cancelled) {
          setCartCount(0);
          setCartItems([]);
        }

        return;
      }

      try {
        const response = await fetch(
          `${CART_API_URL}?userId=${encodeURIComponent(userId)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to fetch cart."
          );
        }

        if (cancelled) {
          return;
        }

        const items = data.items || [];

        /*
        |--------------------------------------------------------------------------
        | Store Cart Items
        |--------------------------------------------------------------------------
        */

        setCartItems(items);

        /*
        |--------------------------------------------------------------------------
        | Total Quantity
        |--------------------------------------------------------------------------
        */

        const totalQuantity = items.reduce(
          (total, item) =>
            total + Number(item.quantity || 0),
          0
        );

        setCartCount(totalQuantity);
      } catch (error) {
        console.error(
          "Failed to fetch cart:",
          error
        );

        if (!cancelled) {
          setCartCount(0);
          setCartItems([]);
        }
      }
    };

    loadCart();

    /*
    |--------------------------------------------------------------------------
    | Listen for Cart Changes
    |--------------------------------------------------------------------------
    |
    | ProductCard se:
    |
    | window.dispatchEvent(
    |   new Event("cart-change")
    | );
    |
    | hone ke baad:
    |
    | Navbar
    | ProductGrid
    | aur doosre cart components
    |
    | automatically latest cart fetch kar lenge.
    |
    |--------------------------------------------------------------------------
    */

    const handleCartChange = () => {
      loadCart();
    };

    window.addEventListener(
      "cart-change",
      handleCartChange
    );

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */

    return () => {
      cancelled = true;

      window.removeEventListener(
        "cart-change",
        handleCartChange
      );
    };
  }, [userId]);

  /*
  |--------------------------------------------------------------------------
  | Return Cart Data
  |--------------------------------------------------------------------------
  */

  return {
    cartCount,
    cartItems,
    refreshCart: fetchCart,
  };
}