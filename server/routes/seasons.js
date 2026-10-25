const router = require('express').Router();
const { pool } = require('../db');
const { toSeason, seasonById } = require('../lib/seasons');

const toRow = (s) => ({
  ...toSeason(s),
  created_at: s.created_at,
  order_count: Number(s.order_count || 0),
  product_count: Number(s.product_count || 0),
});

async function listSeasons(db) {
  const { rows } = await db.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM orders o WHERE o.season_id = s.id) AS order_count,
            (SELECT COUNT(*) FROM products p JOIN orders o ON o.id = p.order_id
              WHERE o.season_id = s.id) AS product_count
       FROM seasons s
      ORDER BY s.created_at DESC, s.id DESC`
  );
  return rows.map(toRow);
}

// Every season, newest first, with order / product counts.
router.get('/', async (req, res, next) => {
  try {
    res.json(await listSeasons(pool));
  } catch (err) {
    next(err);
  }
});

// The one-time migration report (counts before / after).
router.get('/migration', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_meta WHERE key = 'season_migration'`
    );
    res.json(rows.length ? rows[0].value : null);
  } catch (err) {
    next(err);
  }
});

// NEW SEASON: closes the Active season and starts an empty one. Every
// material gets a zero stock row (trays also get a starting quantity of 0).
// Nothing in earlier seasons is touched.
router.post('/', async (req, res, next) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Give the season a name' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE seasons IN EXCLUSIVE MODE');
    const { rows: dup } = await client.query(
      'SELECT 1 FROM seasons WHERE lower(name) = lower($1)',
      [name]
    );
    if (dup.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `A season named "${name}" already exists` });
    }
    await client.query(`UPDATE seasons SET status = 'Closed' WHERE status = 'Active'`);
    const { rows } = await client.query(
      `INSERT INTO seasons (name, status) VALUES ($1, 'Active') RETURNING id`,
      [name]
    );
    const sid = rows[0].id;
    await client.query(
      `INSERT INTO material_stock (season_id, material_id, quantity, starting_quantity)
       SELECT $1, id, 0, CASE WHEN is_limiting THEN 0 END FROM materials
       ON CONFLICT DO NOTHING`,
      [sid]
    );
    await client.query('COMMIT');
    res.status(201).json(await seasonById(pool, sid));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// REOPEN a season as the Active one (the current Active season closes).
router.post('/:id/reopen', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE seasons IN EXCLUSIVE MODE');
    const { rows } = await client.query('SELECT id FROM seasons WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Season not found' });
    }
    await client.query(
      `UPDATE seasons SET status = CASE WHEN id = $1 THEN 'Active' ELSE 'Closed' END
        WHERE id = $1 OR status = 'Active'`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json(await seasonById(pool, req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
