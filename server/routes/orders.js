const router = require('express').Router();
const { pool } = require('../db');
const {
  toOrder,
  insertProduct,
  restoreProductMaterials,
  fetchOrderFull,
} = require('../lib/products');

const ticketFor = (id) => 'T-' + String(id).padStart(4, '0');

// LIST — one row per order, with product count and totals.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*,
              COUNT(p.id) AS product_count,
              COUNT(p.id) FILTER (WHERE p.is_made) AS made_count,
              COUNT(p.id) FILTER (WHERE p.is_delivered) AS delivered_count,
              COALESCE(SUM(p.price), 0) AS total_price,
              COALESCE(SUM(p.cost), 0) AS total_cost
         FROM orders o
         LEFT JOIN products p ON p.order_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC`
    );
    res.json(rows.map((o) => toOrder({ ...o, products: [] })));
  } catch (err) {
    next(err);
  }
});

// DETAIL — order plus all its products (each with materials).
router.get('/:id', async (req, res, next) => {
  try {
    const order = await fetchOrderFull(pool, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// CREATE — order-level info + one or more products created on the spot.
router.post('/', async (req, res, next) => {
  const { customer_name, phone, contact_method, products } = req.body;
  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  const list = Array.isArray(products)
    ? products.filter((p) => p && (p.name || '').trim())
    : [];
  if (!list.length) {
    return res.status(400).json({ error: 'Add at least one product with a name' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO orders (customer_name, phone, contact_method)
       VALUES ($1, $2, $3) RETURNING id`,
      [
        customer_name.trim(),
        (phone || '').trim() || null,
        (contact_method || '').trim() || null,
      ]
    );
    const orderId = rows[0].id;
    await client.query('UPDATE orders SET ticket_number = $1 WHERE id = $2', [
      ticketFor(orderId),
      orderId,
    ]);
    for (const p of list) {
      await insertProduct(client, orderId, p);
    }
    await client.query('COMMIT');
    res.status(201).json(await fetchOrderFull(pool, orderId));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// UPDATE order-level fields (customer, phone, contact, statuses).
router.patch('/:id', async (req, res, next) => {
  try {
    const f = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    const put = (col, val) => {
      sets.push(`${col} = $${i++}`);
      vals.push(val);
    };
    if (f.customer_name !== undefined && String(f.customer_name).trim()) {
      put('customer_name', String(f.customer_name).trim());
    }
    if (f.phone !== undefined) put('phone', String(f.phone).trim() || null);
    if (f.contact_method !== undefined) {
      put('contact_method', String(f.contact_method).trim() || null);
    }
    if (f.payment_status !== undefined) put('payment_status', f.payment_status);
    // Production / Delivery status: a value sets a manual override; *_auto:true
    // clears it so the order follows the value calculated from its products.
    if (f.production_auto === true) put('production_override', null);
    else if (f.production_status !== undefined) {
      put('production_override', f.production_status);
    }
    if (f.delivery_auto === true) put('delivery_override', null);
    else if (f.delivery_status !== undefined) {
      put('delivery_override', f.delivery_status);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rowCount } = await pool.query(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $${i}`,
      vals
    );
    if (!rowCount) return res.status(404).json({ error: 'Order not found' });
    res.json(await fetchOrderFull(pool, req.params.id));
  } catch (err) {
    next(err);
  }
});

// ADD a product to an existing order.
router.post('/:id/products', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    await insertProduct(client, rows[0].id, req.body);
    await client.query('COMMIT');
    res.status(201).json(await fetchOrderFull(pool, req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE an order and restore stock for every product in it.
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id FROM products WHERE order_id = $1',
      [req.params.id]
    );
    for (const p of rows) {
      await restoreProductMaterials(client, p.id);
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
