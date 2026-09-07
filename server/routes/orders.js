const router = require('express').Router();
const { pool } = require('../db');

const toOrder = (o) => ({
  ...o,
  price: Number(o.price),
  cost: Number(o.cost),
  profit: Number(o.price) - Number(o.cost),
});

const SELECT_WITH_PRODUCT = `
  SELECT o.*, p.name AS product_name
    FROM orders o
    LEFT JOIN products p ON p.id = o.product_id
`;

// sign = -1 consumes stock, +1 restores it.
async function applyInventory(client, productId, sign) {
  await client.query('UPDATE products SET quantity = quantity + $1 WHERE id = $2', [
    sign,
    productId,
  ]);
  const { rows } = await client.query(
    'SELECT material_id, quantity_used FROM product_materials WHERE product_id = $1',
    [productId]
  );
  for (const l of rows) {
    await client.query('UPDATE materials SET quantity = quantity + $1 WHERE id = $2', [
      sign * Number(l.quantity_used),
      l.material_id,
    ]);
  }
}

async function fetchOrder(id) {
  const { rows } = await pool.query(`${SELECT_WITH_PRODUCT} WHERE o.id = $1`, [id]);
  return rows[0];
}

// List all orders (newest first).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SELECT_WITH_PRODUCT} ORDER BY o.created_at DESC`);
    res.json(rows.map(toOrder));
  } catch (err) {
    next(err);
  }
});

// Single order detail.
router.get('/:id', async (req, res, next) => {
  try {
    const order = await fetchOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(toOrder(order));
  } catch (err) {
    next(err);
  }
});

// Create an order. Decrements the product by 1 and each linked material by its
// per-product quantity. Price and cost are snapshotted from the product.
router.post('/', async (req, res, next) => {
  const { name, address, phone, instagram, product_id, notes, gift_message } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!product_id) {
    return res.status(400).json({ error: 'Please choose a product' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: prod } = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [product_id]
    );
    if (!prod.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected product no longer exists' });
    }
    await applyInventory(client, product_id, -1);
    const { rows } = await client.query(
      `INSERT INTO orders
         (name, address, phone, instagram, product_id, notes, gift_message, price, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        name.trim(),
        address || null,
        phone || null,
        instagram || null,
        product_id,
        notes || null,
        gift_message || null,
        prod[0].price,
        prod[0].cost,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json(toOrder(await fetchOrder(rows[0].id)));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Edit an order. Any field can change. Switching the product restores the old
// product's stock and consumes the new one's, and re-snapshots price/cost.
router.patch('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!cur.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = cur[0];

    const sets = [];
    const vals = [];
    let i = 1;

    const simpleFields = [
      'name',
      'address',
      'phone',
      'instagram',
      'notes',
      'gift_message',
      'payment_status',
      'progress_status',
    ];
    for (const f of simpleFields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        vals.push(req.body[f]);
      }
    }

    if (
      req.body.product_id !== undefined &&
      Number(req.body.product_id) !== order.product_id
    ) {
      const { rows: prod } = await client.query('SELECT * FROM products WHERE id = $1', [
        req.body.product_id,
      ]);
      if (!prod.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Selected product does not exist' });
      }
      if (order.product_id) await applyInventory(client, order.product_id, +1);
      await applyInventory(client, req.body.product_id, -1);
      sets.push(`product_id = $${i++}`);
      vals.push(req.body.product_id);
      sets.push(`price = $${i++}`);
      vals.push(prod[0].price);
      sets.push(`cost = $${i++}`);
      vals.push(prod[0].cost);
    }

    if (!sets.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nothing to update' });
    }

    vals.push(req.params.id);
    await client.query(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $${i}`,
      vals
    );
    await client.query('COMMIT');
    res.json(toOrder(await fetchOrder(req.params.id)));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Delete an order and restore its product's stock.
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (rows.length && rows[0].product_id) {
      await applyInventory(client, rows[0].product_id, +1);
    }
    await client.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
