-- Runs on every server start. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS materials (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost     NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- In case an older "materials" table already exists without the cost column.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  ticket_number   TEXT UNIQUE,
  customer_name   TEXT NOT NULL,
  phone           TEXT,
  contact_method  TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'Not Paid',
  progress_status TEXT NOT NULL DEFAULT 'Not Made',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products are created inside an order. One row per product, always tied to
-- exactly one order (its ticket number comes from that order).
CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT,
  notes        TEXT,
  gift_message TEXT,
  cost         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_materials (
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id   INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_products_order_id ON products(order_id);
