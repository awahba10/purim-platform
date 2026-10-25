const router = require('express').Router();
const { pool } = require('../db');
const { toProduct, withMaterials } = require('../lib/products');
const { assertWritable, seasonOfBatch } = require('../lib/seasons');

// Writes to a batch follow the batch's own season (a shared link may point at
// a batch from a season other than the one being viewed).
async function writableBatch(req, id) {
  const season = await seasonOfBatch(pool, id);
  if (!season) {
    throw Object.assign(new Error('Batch not found'), { status: 404 });
  }
  assertWritable(req, season);
  return season;
}

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
  const { rows } = await db.query(
    `SELECT b.*, s.name AS season_name, s.status AS season_status
       FROM batches b LEFT JOIN seasons s ON s.id = b.season_id
      WHERE b.id = $1`,
    [id]
  );
  if (!rows.length) return null;
  return { ...rows[0], products: await batchProducts(db, id) };
}

async function appendProducts(client, batchId, productIds) {
  const ids = (productIds || []).map(Number).filter(Boolean);
  if (!ids.length) return;
  // Products may only join a batch from their own season.
  const { rows: bad } = await client.query(
    `SELECT p.id FROM products p
       JOIN orders o ON o.id = p.order_id
       JOIN batches b ON b.id = $1
      WHERE p.id = ANY($2::int[]) AND o.season_id IS DISTINCT FROM b.season_id`,
    [batchId, ids]
  );
  if (bad.length) {
    throw Object.assign(new Error('Some products belong to a different season.'), {
      status: 400,
    });
  }
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
        WHERE b.season_id = $1
        GROUP BY b.id
        ORDER BY b.created_at DESC`,
      [req.season.id]
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
    assertWritable(req, req.season);
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO batches (name, season_id) VALUES ($1, $2) RETURNING id',
      [name.trim(), req.season.id]
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
    await writableBatch(req, req.params.id);
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
    await writableBatch(req, req.params.id);
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
    await writableBatch(req, req.params.id);
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
    await writableBatch(req, req.params.id);
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
    await writableBatch(req, req.params.id);
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
