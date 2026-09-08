const router = require('express').Router();
const { pool } = require('../db');

const toLocation = (l) => ({ ...l, cost: Number(l.cost) });

// List all delivery locations.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM delivery_locations ORDER BY name');
    res.json(rows.map(toLocation));
  } catch (err) {
    next(err);
  }
});

// Add a delivery location.
router.post('/', async (req, res, next) => {
  try {
    const { name, cost } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO delivery_locations (name, cost) VALUES ($1, $2) RETURNING *',
      [name.trim(), Number(cost) || 0]
    );
    res.status(201).json(toLocation(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Edit a delivery location (name and/or reference cost).
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, cost } = req.body;
    const { rows } = await pool.query(
      `UPDATE delivery_locations
         SET name = COALESCE($1, name),
             cost = COALESCE($2, cost)
       WHERE id = $3
       RETURNING *`,
      [
        name !== undefined ? String(name).trim() : null,
        cost !== undefined ? Number(cost) : null,
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });
    res.json(toLocation(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Delete a delivery location.
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM delivery_locations WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
