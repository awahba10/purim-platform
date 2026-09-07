const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM materials');
  if (rows[0].n === 0) {
    await seed();
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const materialNames = [
      'Tray',
      'Cellophane wrap',
      'Ribbon',
      'Gift tag',
      'Chocolate bar',
      'Bag of candy',
      'Bottle of grape juice',
      'Hamantaschen (dozen)',
    ];

    const id = {};
    for (const name of materialNames) {
      const r = await client.query(
        'INSERT INTO materials (name, quantity) VALUES ($1, $2) RETURNING id',
        [name, 50]
      );
      id[name] = r.rows[0].id;
    }

    const classic = await client.query(
      'INSERT INTO products (name, quantity, cost, price) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Classic Purim Tray', 20, 8, 25]
    );
    const deluxe = await client.query(
      'INSERT INTO products (name, quantity, cost, price) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Deluxe Purim Tray', 10, 15, 45]
    );

    const link = (productId, materialName, qty) =>
      client.query(
        'INSERT INTO product_materials (product_id, material_id, quantity_used) VALUES ($1, $2, $3)',
        [productId, id[materialName], qty]
      );

    const classicId = classic.rows[0].id;
    const deluxeId = deluxe.rows[0].id;

    await link(classicId, 'Tray', 1);
    await link(classicId, 'Cellophane wrap', 1);
    await link(classicId, 'Ribbon', 1);
    await link(classicId, 'Gift tag', 1);
    await link(classicId, 'Chocolate bar', 1);
    await link(classicId, 'Bag of candy', 1);

    await link(deluxeId, 'Tray', 1);
    await link(deluxeId, 'Cellophane wrap', 1);
    await link(deluxeId, 'Ribbon', 2);
    await link(deluxeId, 'Gift tag', 1);
    await link(deluxeId, 'Chocolate bar', 2);
    await link(deluxeId, 'Bag of candy', 2);
    await link(deluxeId, 'Bottle of grape juice', 1);
    await link(deluxeId, 'Hamantaschen (dozen)', 1);

    await client.query('COMMIT');
    console.log('[init] Seeded sample materials and products.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { init };
