-- ==========================================
-- Coupon system
-- Run against the shared "aurelia-db" D1 database used by
-- cart-worker, admin-worker and worker.js.
-- ==========================================

CREATE TABLE IF NOT EXISTS coupons (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    code                 TEXT NOT NULL UNIQUE,
    description          TEXT,
    type                 TEXT NOT NULL CHECK (type IN ('%', '$')),
    value                REAL NOT NULL,
    min_order_amount     REAL NOT NULL DEFAULT 0,
    max_discount_amount  REAL,                 -- optional cap, mainly for '%' coupons
    starts_at            TEXT,                 -- NULL = active immediately
    expires_at           TEXT,                 -- NULL = never expires
    usage_limit          INTEGER,              -- NULL = unlimited total redemptions
    per_user_limit       INTEGER,              -- NULL = unlimited per user
    used_count           INTEGER NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit trail of every redemption — also how per-user limits get enforced
-- (COUNT(*) WHERE coupon_id = ? AND user_id = ?).
CREATE TABLE IF NOT EXISTS coupon_usages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id        INTEGER NOT NULL,
    user_id          TEXT NOT NULL,   -- matches orders.user_id (public_id)
    order_id         INTEGER NOT NULL,
    discount_amount  REAL NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user ON coupon_usages(coupon_id, user_id);

-- Orders need to remember which coupon (if any) was applied, alongside
-- the existing loyalty-points discount columns.
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN coupon_discount REAL DEFAULT 0;
