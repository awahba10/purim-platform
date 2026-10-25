const router = require('express').Router();
const { pool } = require('../db');

const toMaterial = (m) => ({
  ...m,
  quantity: Number(m.quantity),
  cost: Number(m.cost),
  is_limiting: Boolean(m.is_limiting),
  starting_quantity:
    m.is_limiting && m.starting_quantity != null ? Number(m.starting_quantity) : null,
});

const TRAY_NEGATIVE =
  "A limiting-stock (tray) quantity can't be below zero. Regular materials can go negative.";

// Whole number or null (blank / missing).
const intOrNull = (v) =>
  v === undefined || v === null || v === '' ? null : Math.floor(Number(v)) || 0;

// List all materials.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM materials ORDER BY name');
    res.json(rows.map(toMaterial));
  } catch (err) {
    next(err);
  }
});

// Add a custom material.
router.post('/', async (req, res, next) => {
  try {
    const { name, quantity, cost, is_limiting, starting_quantity } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Material name is required' });
    }
    const qty = Number(quantity) || 0;
    const limiting = is_limiting === true;
    if (limiting && qty < 0) {
      return res.status(400).json({ error: TRAY_NEGATIVE });
    }
    // A new limiting material starts with "bought" = current stock unless given.
    const start = limiting ? intOrNull(starting_quantity) ?? qty : null;
    const { rows } = await pool.query(
      `INSERT INTO materials (name, quantity, cost, is_limiting, starting_quantity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), qty, Number(cost) || 0, limiting, start]
    );
    res.status(201).json(toMaterial(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Edit a material (name, quantity, cost, limiting flag, starting quantity).
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, quantity, cost, is_limiting, starting_quantity } = req.body;
    const sets = [];
    const vals = [];
    const put = (col, val) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (name !== undefined && String(name).trim()) put('name', String(name).trim());
    if (quantity !== undefined) put('quantity', Number(quantity) || 0);
    if (cost !== undefined) put('cost', Number(cost) || 0);
    if (is_limiting !== undefined) put('is_limiting', is_limiting === true);
    if (is_limiting === false) put('starting_quantity', null);
    else if (starting_quantity !== undefined) {
      put('starting_quantity', intOrNull(starting_quantity));
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    // Trays can never be set below zero (regular materials can).
    const { rows: cur } = await pool.query(
      'SELECT quantity, is_limiting FROM materials WHERE id = $1',
      [req.params.id]
    );
    if (!cur.length) return res.status(404).json({ error: 'Material not found' });
    const finalLimiting =
      is_limiting !== undefined ? is_limiting === true : cur[0].is_limiting;
    const finalQty =
      quantity !== undefined ? Number(quantity) || 0 : Number(cur[0].quantity);
    if (finalLimiting && finalQty < 0) {
      return res.status(400).json({ error: TRAY_NEGATIVE });
    }

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE materials SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found' });
    res.json(toMaterial(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Delete a material.
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM materials WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
