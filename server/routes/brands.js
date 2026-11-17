const router = require('express').Router();
const { pool } = require('../db');
const { assertWritable } = require('../lib/seasons');

// Brands a product can be tagged with. Shared by every season. Products point
// at a brand by id, so renaming one updates every product tagged with it.
const toBrand = (b) => ({
  id: Number(b.id),
  name: b.name,
  product_count: Number(b.product_count || 0),
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS product_count
         FROM brands b ORDER BY lower(b.name)`
    );
    res.json(rows.map(toBrand));
  } catch (err) {
    next(err);
  }
});

async function assertUniqueName(name, exceptId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM brands WHERE lower(name) = lower($1) AND id <> $2',
    [name, exceptId || 0]
  );
  if (rows.length) {
    throw Object.assign(new Error(`There's already a brand named "${name}"`), { status: 400 });
  }
}

router.post('/', async (req, res, next) => {
  try {
    assertWritable(req, req.season);
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Brand name is required' });
    await assertUniqueName(name);
    const { rows } = await pool.query('INSERT INTO brands (name) VALUES ($1) RETURNING *', [
      name,
    ]);
    res.status(201).json(toBrand(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    assertWritable(req, req.season);
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Brand name is required' });
    await assertUniqueName(name, Number(req.params.id));
    const { rows } = await pool.query('UPDATE brands SET name = $1 WHERE id = $2 RETURNING *', [
      name,
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json(toBrand(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Delete — refused while any product (in any season) is tagged with it, so
// stats never lose their brand. Presets just lose their default brand.
router.delete('/:id', async (req, res, next) => {
  try {
    assertWritable(req, req.season);
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM products WHERE brand_id = $1',
      [req.params.id]
    );
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: `${rows[0].n} product(s) are tagged with this brand, so it can't be deleted. Rename it instead, or re-tag those products first.`,
      });
    }
    await pool.query('DELETE FROM brands WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
