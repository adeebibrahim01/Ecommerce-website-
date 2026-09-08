const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    /*
    |--------------------------------------------------------------------------
    | POST /api/cart
    |--------------------------------------------------------------------------
    | Add product to cart.
    | If product already exists for the user, quantity is increased.
    */
    if (request.method === "POST" && url.pathname === "/api/cart") {
      try {
        const body = await request.json();

        const {
          userId,
          productId,
          productName,
          price,
          image,
          quantity = 1,
        } = body;

        if (!userId) {
          return jsonResponse(
            {
              success: false,
              message: "User ID is required.",
            },
            400
          );
        }

        if (!productId) {
          return jsonResponse(
            {
              success: false,
              message: "Product ID is required.",
            },
            400
          );
        }

        if (!productName) {
          return jsonResponse(
            {
              success: false,
              message: "Product name is required.",
            },
            400
          );
        }

        if (price === undefined || price === null || Number.isNaN(Number(price))) {
          return jsonResponse(
            {
              success: false,
              message: "Valid product price is required.",
            },
            400
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Check user
        |--------------------------------------------------------------------------
        */

        const user = await env.DB.prepare(
          `
          SELECT id, name, email
          FROM users
          WHERE id = ?
          `
        )
          .bind(userId)
          .first();

        if (!user) {
          return jsonResponse(
            {
              success: false,
              message: "User not found.",
            },
            404
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Check if product already exists in cart
        |--------------------------------------------------------------------------
        */

        const existingItem = await env.DB.prepare(
          `
          SELECT id, quantity
          FROM cart_items
          WHERE user_id = ?
          AND product_id = ?
          `
        )
          .bind(userId, String(productId))
          .first();

        if (existingItem) {
          const newQuantity =
            Number(existingItem.quantity || 0) + Number(quantity || 1);

          await env.DB.prepare(
            `
            UPDATE cart_items
            SET
              quantity = ?,
              product_name = ?,
              price = ?,
              image = ?
            WHERE id = ?
            `
          )
            .bind(
              newQuantity,
              String(productName),
              Number(price),
              image || null,
              existingItem.id
            )
            .run();

          const updatedItem = await env.DB.prepare(
            `
            SELECT *
            FROM cart_items
            WHERE id = ?
            `
          )
            .bind(existingItem.id)
            .first();

          return jsonResponse({
            success: true,
            message: "Product quantity updated in cart.",
            item: updatedItem,
          });
        }

        /*
        |--------------------------------------------------------------------------
        | Add new cart item
        |--------------------------------------------------------------------------
        */

        const cartItemId = crypto.randomUUID();

        await env.DB.prepare(
          `
          INSERT INTO cart_items (
            id,
            user_id,
            product_id,
            product_name,
            price,
            image,
            quantity
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(
            cartItemId,
            userId,
            String(productId),
            String(productName),
            Number(price),
            image || null,
            Number(quantity) > 0 ? Number(quantity) : 1
          )
          .run();

        const newItem = await env.DB.prepare(
          `
          SELECT *
          FROM cart_items
          WHERE id = ?
          `
        )
          .bind(cartItemId)
          .first();

        return jsonResponse(
          {
            success: true,
            message: "Product added to cart successfully.",
            item: newItem,
          },
          201
        );
      } catch (error) {
        console.error("POST /api/cart error:", error);

        return jsonResponse(
          {
            success: false,
            message: "Failed to add product to cart.",
            error: error.message,
          },
          500
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | GET /api/cart?userId=...
    |--------------------------------------------------------------------------
    | Get all cart items for a user.
    */
    if (request.method === "GET" && url.pathname === "/api/cart") {
      try {
        const userId = url.searchParams.get("userId");

        if (!userId) {
          return jsonResponse(
            {
              success: false,
              message: "User ID is required.",
            },
            400
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Check user
        |--------------------------------------------------------------------------
        */

        const user = await env.DB.prepare(
          `
          SELECT id, name, email
          FROM users
          WHERE id = ?
          `
        )
          .bind(userId)
          .first();

        if (!user) {
          return jsonResponse(
            {
              success: false,
              message: "User not found.",
            },
            404
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Get cart
        |--------------------------------------------------------------------------
        */

        const result = await env.DB.prepare(
          `
          SELECT
            id,
            user_id,
            product_id,
            product_name,
            price,
            image,
            quantity,
            added_at
          FROM cart_items
          WHERE user_id = ?
          ORDER BY added_at DESC
          `
        )
          .bind(userId)
          .all();

        return jsonResponse({
          success: true,
          items: result.results || [],
          count: result.results?.length || 0,
        });
      } catch (error) {
        console.error("GET /api/cart error:", error);

        return jsonResponse(
          {
            success: false,
            message: "Failed to fetch cart.",
            error: error.message,
          },
          500
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Route not found
    |--------------------------------------------------------------------------
    */

    return jsonResponse(
      {
        success: false,
        message: "Cart API route not found.",
      },
      404
    );
  },
};