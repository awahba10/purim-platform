const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function init() {
  // One-time upgrade from the original schema (orders held a single product and
  // an "instagram" column; products were a standalone catalog). The order/product
  // shape changed enough that the cleanest path is to drop those three tables and
  // let schema.sql recreate them. Materials (and their stock) are kept.
  const legacy = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'instagram'
  `);
  if (legacy.rowCount > 0) {
    await pool.query(`
      DROP TABLE IF EXISTS product_materials CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
    `);
    console.log('[init] Upgraded schema: rebuilt orders/products tables.');
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM materials');
  if (rows[0].n === 0) {
    await seedMaterials();
  }
}

async function seedMaterials() {
  // name, quantity in stock, cost per unit
  const rows = [
    ['Tray', 60, 1.75],
    ['Cellophane wrap', 200, 0.2],
    ['Ribbon', 150, 0.35],
    ['Gift tag', 200, 0.1],
    ['Chocolate bar', 120, 1.25],
    ['Bag of candy', 120, 1.5],
    ['Bottle of grape juice', 80, 2.4],
    ['Hamantaschen (dozen)', 60, 6.0],
  ];
  for (const [name, quantity, cost] of rows) {
    await pool.query(
      'INSERT INTO materials (name, quantity, cost) VALUES ($1, $2, $3)',
      [name, quantity, cost]
    );
  }
  console.log('[init] Seeded sample materials.');
}

module.exports = { init };
