import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// ==========================================
// CORS
// ==========================================

app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.options("*", (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods":
        "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
});

// ==========================================
// ADMIN AUTH
// Compatible with AURELIA Admin Worker
//
// Admin Worker token format:
//
// encodedPayload.signature
//
// Payload:
// {
//   uid: userId,
//   exp: Date.now() + TTL
// }
// ==========================================

const encoder = new TextEncoder();

function uint8ArrayToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToUint8Array(base64Url) {
  const base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    base64 +
    "=".repeat((4 - (base64.length % 4)) % 4);

  const binary = atob(padded);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );

  return uint8ArrayToBase64Url(
    new Uint8Array(signature)
  );
}

async function verifyAdminToken(token, secret) {
  try {
    if (!token) {
      return null;
    }

    if (!secret) {
      console.error(
        "ADMIN_JWT_SECRET is missing"
      );

      return null;
    }

    // Admin Worker token has exactly 2 parts:
    //
    // encodedPayload.signature
    //
    const parts = token.split(".");

    if (parts.length !== 2) {
      console.error(
        "Invalid admin token format"
      );

      return null;
    }

    const [encodedPayload, signature] = parts;

    if (!encodedPayload || !signature) {
      return null;
    }

    // IMPORTANT:
    // Admin Worker signs ONLY encodedPayload.
    const expectedSignature = await hmacSign(
      encodedPayload,
      secret
    );

    if (expectedSignature !== signature) {
      console.error(
        "Admin token signature verification failed"
      );

      return null;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(
        base64UrlToUint8Array(encodedPayload)
      )
    );

    // Admin Worker uses "uid"
    if (!payload.uid) {
      console.error(
        "Admin token does not contain uid"
      );

      return null;
    }

    // Admin Worker stores exp in milliseconds:
    //
    // Date.now() + TOKEN_TTL_SECONDS * 1000
    //
    if (!payload.exp) {
      console.error(
        "Admin token does not contain exp"
      );

      return null;
    }

    if (Date.now() > payload.exp) {
      console.error(
        "Admin token has expired"
      );

      return null;
    }

    return payload.uid;
  } catch (error) {
    console.error(
      "Admin token verification error:",
      error
    );

    return null;
  }
}

async function getAdminIdFromAuth(c) {
  const authorization =
    c.req.header("Authorization");

  if (!authorization) {
    return null;
  }

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization
    .substring(7)
    .trim();

  if (!token) {
    return null;
  }

  const secret =
    c.env.ADMIN_JWT_SECRET;

  if (!secret) {
    console.error(
      "ADMIN_JWT_SECRET is missing in Banner Worker"
    );

    return null;
  }

  return verifyAdminToken(
    token,
    secret
  );
}

// ==========================================
// ADMIN GUARD
// ==========================================

async function requireAdmin(c) {
  const adminId =
    await getAdminIdFromAuth(c);

  if (!adminId) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      401
    );
  }

  if (!c.env.DB) {
    return c.json(
      {
        success: false,
        message:
          "Database connection missing.",
      },
      500
    );
  }

  const user =
    await c.env.DB.prepare(
      `
        SELECT id, role, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `
    )
      .bind(adminId)
      .first();

  if (!user) {
    return c.json(
      {
        success: false,
        message:
          "Account not found or inactive.",
      },
      403
    );
  }

  if (user.status !== "active") {
    return c.json(
      {
        success: false,
        message:
          "Account not found or inactive.",
      },
      403
    );
  }

  if (user.role !== "admin") {
    return c.json(
      {
        success: false,
        message:
          "Forbidden: admin access required.",
      },
      403
    );
  }

  return null;
}

// ==========================================
// HELPERS
// ==========================================

function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const stringValue = String(value).trim();

  return stringValue === ""
    ? null
    : stringValue;
}

function cleanRequiredString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizePosition(value) {
  const position = Number(value);

  if (
    !Number.isInteger(position) ||
    position < 1
  ) {
    return 1;
  }

  return position;
}

function normalizeStatus(value) {
  const status =
    cleanRequiredString(value).toLowerCase();

  if (status === "draft") {
    return "draft";
  }

  if (status === "inactive") {
    return "inactive";
  }

  return "active";
}

function normalizePlacement(value) {
  return cleanRequiredString(value)
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeBanner(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    placement: row.placement,
    position: row.position,
    image: row.image,
    text: row.text,
    subtext: row.subtext,
    bottom_text: row.bottom_text,
    button_text: row.button_text,
    button_link: row.button_link,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (c) => {
  return c.json({
    success: true,
    service: "Banner Worker",
    message: "AURELIA Banner API is running",
  });
});

// ==========================================
// PUBLIC — GET BANNERS
// ==========================================

app.get("/banners", async (c) => {
  try {
    const placement = cleanString(
      c.req.query("placement")
    );

    const status = cleanString(
      c.req.query("status")
    );

    let query = `
      SELECT
        id,
        placement,
        position,
        image,
        text,
        subtext,
        bottom_text,
        button_text,
        button_link,
        status,
        created_at,
        updated_at
      FROM banners
      WHERE status = 'active'
    `;

    const values = [];

    if (placement) {
      query += `
        AND placement = ?
      `;

      values.push(placement);
    }

    if (status && status !== "active") {
      query = query.replace(
        "WHERE status = 'active'",
        "WHERE status = ?"
      );

      values.unshift(status);
    }

    query += `
      ORDER BY
        placement ASC,
        position ASC,
        id ASC
    `;

    const result =
      await c.env.DB.prepare(query)
        .bind(...values)
        .all();

    return c.json({
      success: true,
      count: result.results.length,
      banners:
        result.results.map(
          normalizeBanner
        ),
    });
  } catch (error) {
    console.error(
      "GET /banners error:",
      error
    );

    return c.json(
      {
        success: false,
        message:
          "Failed to fetch banners",
      },
      500
    );
  }
});

// ==========================================
// PUBLIC — GET SINGLE BANNER
// ==========================================

app.get("/banners/:id", async (c) => {
  try {
    const id = Number(
      c.req.param("id")
    );

    if (!Number.isInteger(id)) {
      return c.json(
        {
          success: false,
          message: "Invalid banner ID",
        },
        400
      );
    }

    const banner =
      await c.env.DB.prepare(
        `
          SELECT
            id,
            placement,
            position,
            image,
            text,
            subtext,
            bottom_text,
            button_text,
            button_link,
            status,
            created_at,
            updated_at
          FROM banners
          WHERE id = ?
          LIMIT 1
        `
      )
        .bind(id)
        .first();

    if (!banner) {
      return c.json(
        {
          success: false,
          message: "Banner not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      banner:
        normalizeBanner(banner),
    });
  } catch (error) {
    console.error(
      "GET /banners/:id error:",
      error
    );

    return c.json(
      {
        success: false,
        message:
          "Failed to fetch banner",
      },
      500
    );
  }
});

// ==========================================
// ADMIN — GET BANNERS
// ==========================================

app.get(
  "/admin/banners",
  async (c) => {
    const authError =
      await requireAdmin(c);

    if (authError) {
      return authError;
    }

    try {
      const page = Math.max(
        1,
        Number.parseInt(
          c.req.query("page") || "1",
          10
        )
      );

      const limit = Math.min(
        50,
        Math.max(
          1,
          Number.parseInt(
            c.req.query("limit") || "20",
            10
          )
        )
      );

      const offset =
        (page - 1) * limit;

      const placement = cleanString(
        c.req.query("placement")
      );

      const status = cleanString(
        c.req.query("status")
      );

      const search = cleanString(
        c.req.query("search")
      );

      let where = "WHERE 1 = 1";

      const values = [];

      if (placement) {
        where +=
          " AND placement = ?";

        values.push(placement);
      }

      if (status) {
        where += " AND status = ?";

        values.push(status);
      }

      // IMPORTANT:
      // banners table does NOT have a "name"
      // column, so search only valid columns.
      if (search) {
        where += `
          AND (
            placement LIKE ?
            OR text LIKE ?
            OR subtext LIKE ?
            OR bottom_text LIKE ?
            OR button_text LIKE ?
          )
        `;

        const searchValue =
          `%${search}%`;

        values.push(
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue
        );
      }

      const countResult =
        await c.env.DB.prepare(
          `
            SELECT COUNT(*) AS total
            FROM banners
            ${where}
          `
        )
          .bind(...values)
          .first();

      const total =
        Number(
          countResult?.total || 0
        );

      const bannersResult =
        await c.env.DB.prepare(
          `
            SELECT
              id,
              placement,
              position,
              image,
              text,
              subtext,
              bottom_text,
              button_text,
              button_link,
              status,
              created_at,
              updated_at
            FROM banners
            ${where}
            ORDER BY
              placement ASC,
              position ASC,
              id DESC
            LIMIT ? OFFSET ?
          `
        )
          .bind(
            ...values,
            limit,
            offset
          )
          .all();

      return c.json({
        success: true,
        banners:
          bannersResult.results.map(
            normalizeBanner
          ),
        pagination: {
          page,
          limit,
          total,
          total_pages:
            Math.ceil(
              total / limit
            ),
        },
      });
    } catch (error) {
      console.error(
        "GET /admin/banners error:",
        error
      );

      return c.json(
        {
          success: false,
          message:
            "Failed to fetch admin banners",
        },
        500
      );
    }
  }
);

// ==========================================
// ADMIN — CREATE BANNER
// ==========================================

app.post(
  "/admin/banners",
  async (c) => {
    const authError =
      await requireAdmin(c);

    if (authError) {
      return authError;
    }

    try {
      const body =
        await c.req.json();

      const placement =
        normalizePlacement(
          body.placement
        );

      const position =
        normalizePosition(
          body.position
        );

      const image =
        cleanRequiredString(
          body.image
        );

      const text =
        cleanRequiredString(
          body.text
        );

      const subtext =
        cleanString(
          body.subtext
        );

      const bottomText =
        cleanString(
          body.bottom_text
        );

      const buttonText =
        cleanString(
          body.button_text
        );

      const buttonLink =
        cleanString(
          body.button_link
        );

      const status =
        normalizeStatus(
          body.status
        );

      if (!placement) {
        return c.json(
          {
            success: false,
            message:
              "Placement is required",
          },
          400
        );
      }

      if (!image) {
        return c.json(
          {
            success: false,
            message:
              "Image is required",
          },
          400
        );
      }

      if (!text) {
        return c.json(
          {
            success: false,
            message:
              "Text is required",
          },
          400
        );
      }

      const existing =
        await c.env.DB.prepare(
          `
            SELECT id
            FROM banners
            WHERE placement = ?
              AND position = ?
            LIMIT 1
          `
        )
          .bind(
            placement,
            position
          )
          .first();

      if (existing) {
        return c.json(
          {
            success: false,
            message:
              "This position is already used in this placement",
          },
          409
        );
      }

      const result =
        await c.env.DB.prepare(
          `
            INSERT INTO banners (
              placement,
              position,
              image,
              text,
              subtext,
              bottom_text,
              button_text,
              button_link,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(
            placement,
            position,
            image,
            text,
            subtext,
            bottomText,
            buttonText,
            buttonLink,
            status
          )
          .run();

      const banner =
        await c.env.DB.prepare(
          `
            SELECT
              id,
              placement,
              position,
              image,
              text,
              subtext,
              bottom_text,
              button_text,
              button_link,
              status,
              created_at,
              updated_at
            FROM banners
            WHERE id = ?
            LIMIT 1
          `
        )
          .bind(
            result.meta.last_row_id
          )
          .first();

      return c.json(
        {
          success: true,
          message:
            "Banner created successfully",
          banner:
            normalizeBanner(
              banner
            ),
        },
        201
      );
    } catch (error) {
      console.error(
        "POST /admin/banners error:",
        error
      );

      return c.json(
        {
          success: false,
          message:
            "Failed to create banner",
        },
        500
      );
    }
  }
);

// ==========================================
// ADMIN — UPDATE BANNER
// ==========================================

app.patch(
  "/admin/banners/:id",
  async (c) => {
    const authError =
      await requireAdmin(c);

    if (authError) {
      return authError;
    }

    try {
      const id = Number(
        c.req.param("id")
      );

      if (!Number.isInteger(id)) {
        return c.json(
          {
            success: false,
            message:
              "Invalid banner ID",
          },
          400
        );
      }

      const existing =
        await c.env.DB.prepare(
          `
            SELECT *
            FROM banners
            WHERE id = ?
            LIMIT 1
          `
        )
          .bind(id)
          .first();

      if (!existing) {
        return c.json(
          {
            success: false,
            message:
              "Banner not found",
          },
          404
        );
      }

      const body =
        await c.req.json();

      const placement =
        body.placement !== undefined
          ? normalizePlacement(
              body.placement
            )
          : existing.placement;

      const position =
        body.position !== undefined
          ? normalizePosition(
              body.position
            )
          : existing.position;

      const image =
        body.image !== undefined
          ? cleanRequiredString(
              body.image
            )
          : existing.image;

      const text =
        body.text !== undefined
          ? cleanRequiredString(
              body.text
            )
          : existing.text;

      const subtext =
        body.subtext !== undefined
          ? cleanString(
              body.subtext
            )
          : existing.subtext;

      const bottomText =
        body.bottom_text !== undefined
          ? cleanString(
              body.bottom_text
            )
          : existing.bottom_text;

      const buttonText =
        body.button_text !== undefined
          ? cleanString(
              body.button_text
            )
          : existing.button_text;

      const buttonLink =
        body.button_link !== undefined
          ? cleanString(
              body.button_link
            )
          : existing.button_link;

      const status =
        body.status !== undefined
          ? normalizeStatus(
              body.status
            )
          : existing.status;

      if (!placement) {
        return c.json(
          {
            success: false,
            message:
              "Placement is required",
          },
          400
        );
      }

      if (!image) {
        return c.json(
          {
            success: false,
            message:
              "Image is required",
          },
          400
        );
      }

      if (!text) {
        return c.json(
          {
            success: false,
            message:
              "Text is required",
          },
          400
        );
      }

      const duplicate =
        await c.env.DB.prepare(
          `
            SELECT id
            FROM banners
            WHERE placement = ?
              AND position = ?
              AND id != ?
            LIMIT 1
          `
        )
          .bind(
            placement,
            position,
            id
          )
          .first();

      if (duplicate) {
        return c.json(
          {
            success: false,
            message:
              "This position is already used in this placement",
          },
          409
        );
      }

      await c.env.DB.prepare(
        `
          UPDATE banners
          SET
            placement = ?,
            position = ?,
            image = ?,
            text = ?,
            subtext = ?,
            bottom_text = ?,
            button_text = ?,
            button_link = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
        .bind(
          placement,
          position,
          image,
          text,
          subtext,
          bottomText,
          buttonText,
          buttonLink,
          status,
          id
        )
        .run();

      const banner =
        await c.env.DB.prepare(
          `
            SELECT
              id,
              placement,
              position,
              image,
              text,
              subtext,
              bottom_text,
              button_text,
              button_link,
              status,
              created_at,
              updated_at
            FROM banners
            WHERE id = ?
            LIMIT 1
          `
        )
          .bind(id)
          .first();

      return c.json({
        success: true,
        message:
          "Banner updated successfully",
        banner:
          normalizeBanner(
            banner
          ),
      });
    } catch (error) {
      console.error(
        "PATCH /admin/banners/:id error:",
        error
      );

      return c.json(
        {
          success: false,
          message:
            "Failed to update banner",
        },
        500
      );
    }
  }
);

// ==========================================
// ADMIN — DELETE BANNER
// ==========================================

app.delete(
  "/admin/banners/:id",
  async (c) => {
    const authError =
      await requireAdmin(c);

    if (authError) {
      return authError;
    }

    try {
      const id = Number(
        c.req.param("id")
      );

      if (!Number.isInteger(id)) {
        return c.json(
          {
            success: false,
            message:
              "Invalid banner ID",
          },
          400
        );
      }

      const existing =
        await c.env.DB.prepare(
          `
            SELECT id
            FROM banners
            WHERE id = ?
            LIMIT 1
          `
        )
          .bind(id)
          .first();

      if (!existing) {
        return c.json(
          {
            success: false,
            message:
              "Banner not found",
          },
          404
        );
      }

      await c.env.DB.prepare(
        `
          DELETE FROM banners
          WHERE id = ?
        `
      )
        .bind(id)
        .run();

      return c.json({
        success: true,
        message:
          "Banner deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE /admin/banners/:id error:",
        error
      );

      return c.json(
        {
          success: false,
          message:
            "Failed to delete banner",
        },
        500
      );
    }
  }
);

// ==========================================
// NOT FOUND
// ==========================================

app.notFound((c) => {
  return c.json(
    {
      success: false,
      message: "Route not found",
    },
    404
  );
});

// ==========================================
// GLOBAL ERROR
// ==========================================

app.onError((error, c) => {
  console.error(
    "Worker error:",
    error
  );

  return c.json(
    {
      success: false,
      message:
        "Internal server error",
    },
    500
  );
});

export default app;