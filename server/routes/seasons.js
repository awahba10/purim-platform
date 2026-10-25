const router = require('express').Router();
const { pool } = require('../db');
const { toSeason, seasonById } = require('../lib/seasons');

const toRow = (s) => ({
  ...toSeason(s),
  created_at: s.created_at,
  order_count: Number(s.order_count || 0),
  product_count: Number(s.product_count || 0),
  batch_count: Number(s.batch_count || 0),
});

async function listSeasons(db) {
  const { rows } = await db.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM orders o WHERE o.season_id = s.id) AS order_count,
            (SELECT COUNT(*) FROM products p JOIN orders o ON o.id = p.order_id
              WHERE o.season_id = s.id) AS product_count,
            (SELECT COUNT(*) FROM batches b WHERE b.season_id = s.id) AS batch_count
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

// DELETE a season — only an empty, non-active one (no orders, no batches),
// e.g. one made by mistake. Its zero stock rows go with it. Seasons holding
// any data can never be deleted.
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE seasons IN EXCLUSIVE MODE');
    const { rows } = await client.query(
      `SELECT s.status,
              (SELECT COUNT(*)::int FROM orders o WHERE o.season_id = s.id) AS orders,
              (SELECT COUNT(*)::int FROM batches b WHERE b.season_id = s.id) AS batches
         FROM seasons s WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Season not found' });
    }
    const s = rows[0];
    if (s.status === 'Active') {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: "The active season can't be deleted. Reopen another season first." });
    }
    if (s.orders > 0 || s.batches > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `This season has ${s.orders} order(s) and ${s.batches} batch(es), so it can't be deleted. Only empty seasons can be.`,
      });
    }
    await client.query('DELETE FROM seasons WHERE id = $1', [req.params.id]);
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
