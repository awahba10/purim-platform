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
  id               SERIAL PRIMARY KEY,
  ticket_number    TEXT UNIQUE,
  customer_name    TEXT NOT NULL,
  phone            TEXT,
  contact_method   TEXT,
  payment_status   TEXT NOT NULL DEFAULT 'Not Paid',
  progress_override TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Progress is normally calculated from the order's products' is_made flags.
-- progress_override holds a manually chosen value ('None Made' | 'Some Made' |
-- 'All Made' | 'Delivered') and is NULL when the order follows the auto value.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS progress_override TEXT;
ALTER TABLE orders DROP COLUMN IF EXISTS progress_status;

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

-- Per-product progress: has this product been assembled yet?
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_made BOOLEAN NOT NULL DEFAULT false;

-- Per-product fulfillment. 'Delivery' products carry an address, a delivery
-- location name (free text), and a manually chosen delivery charge. 'Pickup'
-- products carry none of those.
ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment TEXT NOT NULL DEFAULT 'Delivery';
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_location TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0;
-- Free-text delivery instructions (e.g. "leave with doorman"), separate from the
-- maker-facing "notes" field. Optional add-ons: recipient_name.
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipient_name TEXT;

CREATE TABLE IF NOT EXISTS product_materials (
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id   INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_products_order_id ON products(order_id);

-- Premade product presets: a speed shortcut for New Order. Not involved in
-- inventory or order logic — purely a template. Cost is always computed from
-- current material costs, never stored.
CREATE TABLE IF NOT EXISTS presets (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preset_materials (
  preset_id     INTEGER NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  material_id   INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (preset_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_preset_materials_preset ON preset_materials(preset_id);

-- Delivery locations: a reference list only. The cost figure is never applied
-- automatically anywhere; only the names feed the New Order location selector.
CREATE TABLE IF NOT EXISTS delivery_locations (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cost NUMERIC(10, 2) NOT NULL DEFAULT 0
);
