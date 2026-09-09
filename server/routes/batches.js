const router = require('express').Router();
const { pool } = require('../db');
const { toProduct, withMaterials } = require('../lib/products');

const toBatch = (b) => ({
  ...b,
  product_count: Number(b.product_count || 0),
  delivered_count: Number(b.delivered_count || 0),
});

async function batchProducts(db, batchId) {
  const { rows } = await db.query(
    `SELECT p.*, o.ticket_number, o.customer_name, o.payment_status,
            b.name AS batch_name
       FROM products p
       JOIN orders o ON o.id = p.order_id
       LEFT JOIN batches b ON b.id = p.batch_id
      WHERE p.batch_id = $1
      ORDER BY p.batch_position, p.id`,
    [batchId]
  );
  const withMats = await withMaterials(db, rows);
  return withMats.map(toProduct);
}

async function fetchBatch(db, id) {
  const { rows } = await db.query('SELECT * FROM batches WHERE id = $1', [id]);
  if (!rows.length) return null;
  return { ...rows[0], products: await batchProducts(db, id) };
}

async function appendProducts(client, batchId, productIds) {
  const ids = (productIds || []).map(Number).filter(Boolean);
  if (!ids.length) return;
  const { rows: mx } = await client.query(
    'SELECT COALESCE(MAX(batch_position) + 1, 0) AS pos FROM products WHERE batch_id = $1',
    [batchId]
  );
  let pos = Number(mx[0].pos);
  for (const id of ids) {
    await client.query(
      'UPDATE products SET batch_id = $1, batch_position = $2 WHERE id = $3',
      [batchId, pos++, id]
    );
  }
}

// LIST batches with counts.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*,
              COUNT(p.id) AS product_count,
              COUNT(p.id) FILTER (WHERE p.is_delivered) AS delivered_count
         FROM batches b
         LEFT JOIN products p ON p.batch_id = b.id
        GROUP BY b.id
        ORDER BY b.created_at DESC`
    );
    res.json(rows.map(toBatch));
  } catch (err) {
    next(err);
  }
});

// One batch + its ordered products (read-only detail view).
router.get('/:id', async (req, res, next) => {
  try {
    const batch = await fetchBatch(pool, req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    next(err);
  }
});

// Create a batch, optionally assigning products in the given order.
router.post('/', async (req, res, next) => {
  const { name, product_ids } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Batch name is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO batches (name) VALUES ($1) RETURNING id',
      [name.trim()]
    );
    await appendProducts(client, rows[0].id, product_ids);
    await client.query('COMMIT');
    res.status(201).json(await fetchBatch(pool, rows[0].id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Rename a batch.
router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Batch name is required' });
    }
    const { rows } = await pool.query(
      'UPDATE batches SET name = $1 WHERE id = $2 RETURNING id',
      [name.trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Batch not found' });
    res.json(await fetchBatch(pool, req.params.id));
  } catch (err) {
    next(err);
  }
});

// Delete a batch (its products fall back to no batch).
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM batches WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Add products to a batch (appended to the end of its order).
router.post('/:id/products', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id FROM batches WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Batch not found' });
    }
    await appendProducts(client, req.params.id, req.body.product_ids);
    await client.query('COMMIT');
    res.json(await fetchBatch(pool, req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Remove one product from a batch.
router.delete('/:id/products/:productId', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE products SET batch_id = NULL WHERE id = $1 AND batch_id = $2',
      [req.params.productId, req.params.id]
    );
    res.json(await fetchBatch(pool, req.params.id));
  } catch (err) {
    next(err);
  }
});

// Reorder a batch's products (drag-and-drop result). Body: { product_ids: [...] }.
router.patch('/:id/order', async (req, res, next) => {
  const ids = (req.body.product_ids || []).map(Number).filter(Boolean);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let idx = 0; idx < ids.length; idx++) {
      await client.query(
        'UPDATE products SET batch_position = $1 WHERE id = $2 AND batch_id = $3',
        [idx, ids[idx], req.params.id]
      );
    }
    await client.query('COMMIT');
    res.json(await fetchBatch(pool, req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
