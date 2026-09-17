-- Same root cause as the cart bug: wishlist_items had UNIQUE(user_id,
-- product_id) only, so a normal wishlist-add and a deal wishlist-add of the
-- SAME product collided into one row. Fix: make deal_id part of the
-- uniqueness, and NOT NULL (default '') so repeat adds of the same kind
-- still merge/DO-NOTHING correctly (SQLite treats NULL <> NULL).

ALTER TABLE wishlist_items RENAME TO wishlist_items_old;

CREATE TABLE wishlist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  product_id  INTEGER NOT NULL,
  deal_id     TEXT NOT NULL DEFAULT '',
  deal_name   TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, product_id, deal_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO wishlist_items (id, user_id, product_id, deal_id, deal_name, created_at)
SELECT id, user_id, product_id, COALESCE(NULLIF(deal_id, ''), ''), deal_name, created_at
FROM wishlist_items_old;

DROP TABLE wishlist_items_old;
