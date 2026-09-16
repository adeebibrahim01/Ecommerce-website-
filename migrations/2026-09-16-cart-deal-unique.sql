-- Root cause: cart table's UNIQUE(user_id, product_id) treats a "deal" add
-- and a "normal" add of the SAME product as the exact same row. So adding
-- from Women/Men (normal) and then adding the same product from Deals
-- collide into one row -> button shows "Added to Cart" on both, and
-- whichever add happened second silently overwrites the first.
--
-- Fix: make deal_id part of the uniqueness, and make it NOT NULL (default
-- '') because SQLite treats NULL <> NULL, so a UNIQUE(..., deal_id) with
-- deal_id left NULL would never conflict/merge correctly for repeat adds.

ALTER TABLE cart RENAME TO cart_old;

CREATE TABLE cart (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  product_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  price          REAL NOT NULL DEFAULT 0,
  image          TEXT,
  quantity       INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  deal_id        TEXT NOT NULL DEFAULT '',
  deal_name      TEXT,
  original_price REAL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id, deal_id)
);

INSERT INTO cart (id, user_id, product_id, name, price, image, quantity, deal_id, deal_name, original_price, created_at, updated_at)
SELECT id, user_id, product_id, name, price, image, quantity, COALESCE(NULLIF(deal_id, ''), ''), deal_name, original_price, created_at, updated_at
FROM cart_old;

DROP TABLE cart_old;
