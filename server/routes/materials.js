const router = require('express').Router();
const { pool } = require('../db');

const toMaterial = (m) => ({ ...m, quantity: Number(m.quantity) });

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
    const { name, quantity } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Material name is required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO materials (name, quantity) VALUES ($1, $2) RETURNING *',
      [name.trim(), Number(quantity) || 0]
    );
    res.status(201).json(toMaterial(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Edit a material (name and/or quantity).
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, quantity } = req.body;
    const { rows } = await pool.query(
      `UPDATE materials
         SET name = COALESCE($1, name),
             quantity = COALESCE($2, quantity)
       WHERE id = $3
       RETURNING *`,
      [
        name !== undefined ? String(name).trim() : null,
        quantity !== undefined ? Number(quantity) : null,
        req.params.id,
      ]
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
