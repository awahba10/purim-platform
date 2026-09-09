const router = require('express').Router();
const { pool } = require('../db');
const {
  toProduct,
  cleanMaterials,
  withMaterials,
  restoreProductMaterials,
} = require('../lib/products');

const SELECT_PRODUCT = `
  SELECT p.*, o.ticket_number, o.customer_name, o.payment_status,
         b.name AS batch_name
    FROM products p
    JOIN orders o ON o.id = p.order_id
    LEFT JOIN batches b ON b.id = p.batch_id
`;

// LIST every product across all orders (one row per product).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_PRODUCT} ORDER BY o.created_at DESC, p.id`
    );
    const withMats = await withMaterials(pool, rows);
    res.json(withMats.map(toProduct));
  } catch (err) {
    next(err);
  }
});

// EDIT a product — this is the same underlying record the order shows.
router.patch('/:id', async (req, res, next) => {
  const f = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!cur.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const sets = [];
    const vals = [];
    let i = 1;
    const put = (col, val) => {
      sets.push(`${col} = $${i++}`);
      vals.push(val);
    };
    if (f.name !== undefined && String(f.name).trim()) {
      put('name', String(f.name).trim());
    }
    if (f.address !== undefined) put('address', String(f.address).trim() || null);
    if (f.notes !== undefined) put('notes', String(f.notes).trim() || null);
    if (f.gift_message !== undefined) {
      put('gift_message', String(f.gift_message).trim() || null);
    }
    if (f.cost !== undefined && f.cost !== '' && f.cost !== null) {
      put('cost', Number(f.cost) || 0);
    }
    if (f.price !== undefined && f.price !== '' && f.price !== null) {
      put('price', Number(f.price) || 0);
    }
    if (f.is_made !== undefined) put('is_made', Boolean(f.is_made));
    if (f.fulfillment !== undefined) {
      put('fulfillment', f.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery');
    }
    if (f.delivery_location !== undefined) {
      put('delivery_location', String(f.delivery_location).trim() || null);
    }
    if (
      f.delivery_charge !== undefined &&
      f.delivery_charge !== '' &&
      f.delivery_charge !== null
    ) {
      put('delivery_charge', Number(f.delivery_charge) || 0);
    }
    if (f.delivery_instructions !== undefined) {
      put('delivery_instructions', String(f.delivery_instructions).trim() || null);
    }
    if (f.recipient_name !== undefined) {
      put('recipient_name', String(f.recipient_name).trim() || null);
    }
    if (f.gift_label_printed !== undefined) {
      put('gift_label_printed', Boolean(f.gift_label_printed));
    }
    if (f.shipping_label_printed !== undefined) {
      put('shipping_label_printed', Boolean(f.shipping_label_printed));
    }
    if (f.is_delivered !== undefined) put('is_delivered', Boolean(f.is_delivered));
    if (f.batch_id !== undefined) {
      const target = f.batch_id === null || f.batch_id === '' ? null : Number(f.batch_id);
      put('batch_id', target);
      if (target != null) {
        const { rows: mx } = await client.query(
          'SELECT COALESCE(MAX(batch_position) + 1, 0) AS pos FROM products WHERE batch_id = $1',
          [target]
        );
        put('batch_position', Number(mx[0].pos));
      }
    }
    if (sets.length) {
      vals.push(req.params.id);
      await client.query(
        `UPDATE products SET ${sets.join(', ')} WHERE id = $${i}`,
        vals
      );
    }

    if (Array.isArray(f.materials)) {
      await restoreProductMaterials(client, req.params.id);
      await client.query('DELETE FROM product_materials WHERE product_id = $1', [
        req.params.id,
      ]);
      for (const m of cleanMaterials(f.materials)) {
        await client.query(
          `INSERT INTO product_materials (product_id, material_id, quantity_used)
           VALUES ($1, $2, $3)`,
          [req.params.id, m.material_id, m.quantity_used]
        );
        await client.query(
          'UPDATE materials SET quantity = quantity - $1 WHERE id = $2',
          [m.quantity_used, m.material_id]
        );
      }
    }

    await client.query('COMMIT');

    const { rows: fresh } = await pool.query(`${SELECT_PRODUCT} WHERE p.id = $1`, [
      req.params.id,
    ]);
    const withMats = await withMaterials(pool, fresh);
    res.json(toProduct(withMats[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE a product and restore its materials' stock.
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await restoreProductMaterials(client, req.params.id);
    await client.query('DELETE FROM products WHERE id = $1', [req.params.id]);
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
