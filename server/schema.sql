-- Runs on every server start. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS materials (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price    NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_materials (
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id   INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, material_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  instagram       TEXT,
  product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
  notes           TEXT,
  gift_message    TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'Not Paid',
  progress_status TEXT NOT NULL DEFAULT 'Not Made',
  price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cost            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
