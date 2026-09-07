const router = require('express').Router();
const { pool } = require('../db');

const toProduct = (p, materials = []) => ({
  ...p,
  quantity: Number(p.quantity),
  cost: Number(p.cost),
  price: Number(p.price),
  profit: Number(p.price) - Number(p.cost),
  materials,
});

// List products, each with its linked materials.
router.get('/', async (req, res, next) => {
  try {
    const { rows: products } = await pool.query('SELECT * FROM products ORDER BY name');
    const { rows: links } = await pool.query(
      `SELECT pm.product_id, pm.material_id, pm.quantity_used, m.name AS material_name
         FROM product_materials pm
         JOIN materials m ON m.id = pm.material_id
       ORDER BY m.name`
    );
    const byProduct = {};
    for (const l of links) {
      (byProduct[l.product_id] = byProduct[l.product_id] || []).push({
        material_id: l.material_id,
        material_name: l.material_name,
        quantity_used: Number(l.quantity_used),
      });
    }
    res.json(products.map((p) => toProduct(p, byProduct[p.id] || [])));
  } catch (err) {
    next(err);
  }
});

async function replaceLinks(client, productId, materials) {
  await client.query('DELETE FROM product_materials WHERE product_id = $1', [productId]);
  for (const m of materials || []) {
    if (!m || !m.material_id) continue;
    await client.query(
      `INSERT INTO product_materials (product_id, material_id, quantity_used)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, material_id) DO UPDATE SET quantity_used = EXCLUDED.quantity_used`,
      [productId, m.material_id, Math.max(1, Number(m.quantity_used) || 1)]
    );
  }
}

// Create a product with linked materials.
router.post('/', async (req, res, next) => {
  const { name, quantity, cost, price, materials } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO products (name, quantity, cost, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), Number(quantity) || 0, Number(cost) || 0, Number(price) || 0]
    );
    await replaceLinks(client, rows[0].id, materials);
    await client.query('COMMIT');
    res.status(201).json(toProduct(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Edit a product. If "materials" is provided, it replaces the full link list.
router.patch('/:id', async (req, res, next) => {
  const { name, quantity, cost, price, materials } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE products
         SET name = COALESCE($1, name),
             quantity = COALESCE($2, quantity),
             cost = COALESCE($3, cost),
             price = COALESCE($4, price)
       WHERE id = $5
       RETURNING *`,
      [
        name !== undefined ? String(name).trim() : null,
        quantity !== undefined ? Number(quantity) : null,
        cost !== undefined ? Number(cost) : null,
        price !== undefined ? Number(price) : null,
        req.params.id,
      ]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    if (Array.isArray(materials)) {
      await replaceLinks(client, rows[0].id, materials);
    }
    await client.query('COMMIT');
    res.json(toProduct(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Delete a product.
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
