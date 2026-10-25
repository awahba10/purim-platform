// Season helpers: which season a request is looking at, which season a record
// belongs to, and the read-only rule for closed seasons.

const { pool } = require('../db');

const toSeason = (s) => (s ? { id: Number(s.id), name: s.name, status: s.status } : null);

// The newest Active season (the app's default).
async function activeSeason(db = pool) {
  const { rows } = await db.query(
    `SELECT * FROM seasons WHERE status = 'Active'
      ORDER BY created_at DESC, id DESC LIMIT 1`
  );
  if (rows.length) return toSeason(rows[0]);
  const { rows: any } = await db.query(
    'SELECT * FROM seasons ORDER BY created_at DESC, id DESC LIMIT 1'
  );
  return toSeason(any[0]);
}

async function seasonById(db, id) {
  const { rows } = await db.query('SELECT * FROM seasons WHERE id = $1', [id]);
  return toSeason(rows[0]);
}

// Express middleware: req.season = the season the client is viewing (header
// X-Season-Id, falling back to the Active season). req.unlockedSeasonId = the
// closed season the client has explicitly unlocked for editing, if any.
async function seasonContext(req, res, next) {
  try {
    const wanted = Number(req.get('X-Season-Id'));
    req.season = (wanted && (await seasonById(pool, wanted))) || (await activeSeason(pool));
    if (!req.season) return res.status(503).json({ error: 'No season set up yet' });
    req.unlockedSeasonId = Number(req.get('X-Season-Unlock')) || null;
    next();
  } catch (err) {
    next(err);
  }
}

// Closed seasons are read-only unless the client unlocked that exact season.
function assertWritable(req, season) {
  if (!season) {
    throw Object.assign(new Error('Season not found'), { status: 404 });
  }
  if (season.status === 'Closed' && req.unlockedSeasonId !== season.id) {
    throw Object.assign(
      new Error(`${season.name} is closed and locked. Unlock it to make changes.`),
      { status: 423 }
    );
  }
}

async function seasonOfOrder(db, orderId) {
  const { rows } = await db.query(
    `SELECT s.* FROM orders o JOIN seasons s ON s.id = o.season_id WHERE o.id = $1`,
    [orderId]
  );
  return toSeason(rows[0]);
}

async function seasonOfProduct(db, productId) {
  const { rows } = await db.query(
    `SELECT s.* FROM products p
       JOIN orders o ON o.id = p.order_id
       JOIN seasons s ON s.id = o.season_id
      WHERE p.id = $1`,
    [productId]
  );
  return toSeason(rows[0]);
}

async function seasonOfBatch(db, batchId) {
  const { rows } = await db.query(
    `SELECT s.* FROM batches b JOIN seasons s ON s.id = b.season_id WHERE b.id = $1`,
    [batchId]
  );
  return toSeason(rows[0]);
}

// Lock the season row so ticket numbers are handed out one at a time, then
// return the next ticket for that season (T-0001, T-0002, ...).
async function nextTicket(client, seasonId) {
  await client.query('SELECT id FROM seasons WHERE id = $1 FOR UPDATE', [seasonId]);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(substring(ticket_number FROM '^T-([0-9]+)$')::int), 0) + 1 AS n
       FROM orders WHERE season_id = $1`,
    [seasonId]
  );
  return 'T-' + String(rows[0].n).padStart(4, '0');
}

module.exports = {
  toSeason,
  activeSeason,
  seasonById,
  seasonContext,
  assertWritable,
  seasonOfOrder,
  seasonOfProduct,
  seasonOfBatch,
  nextTicket,
};
