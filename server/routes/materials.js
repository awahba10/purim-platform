const router = require('express').Router();
const { pool } = require('../db');
const { assertWritable } = require('../lib/seasons');

// The materials list (name, cost, limiting flag) is shared by every season;
// quantity and starting_quantity come from material_stock for the season being
// viewed (no row = 0 in stock).
const CATEGORIES = ['tray', 'filler', 'wine', 'grocery'];
// Categories with a "bought" (starting) quantity. Grocery is unlimited.
const COUNTED = ['tray', 'filler', 'wine'];

const SELECT_MATERIALS = `
  SELECT m.id, m.name, m.cost, m.is_limiting, m.category,
         COALESCE(s.quantity, 0) AS quantity,
         s.starting_quantity
    FROM materials m
    LEFT JOIN material_stock s ON s.material_id = m.id AND s.season_id = $1
`;

const toMaterial = (m) => {
  const category = CATEGORIES.includes(m.category)
    ? m.category
    : m.is_limiting
    ? 'tray'
    : 'filler';
  return {
    ...m,
    category,
    quantity: Number(m.quantity),
    cost: Number(m.cost),
    is_limiting: category === 'tray',
    starting_quantity:
      COUNTED.includes(category) && m.starting_quantity != null
        ? Number(m.starting_quantity)
        : null,
  };
};

// Accept `category`, or the older `is_limiting` flag. undefined = unchanged.
function cleanCategory(body) {
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      throw Object.assign(new Error('Unknown inventory category'), { status: 400 });
    }
    return body.category;
  }
  if (body.is_limiting !== undefined) return body.is_limiting === true ? 'tray' : 'filler';
  return undefined;
}

// What this season's orders have used of a material so far.
async function usedInSeason(db, seasonId, materialId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(pm.quantity_used), 0)::int AS n
       FROM product_materials pm
       JOIN products p ON p.id = pm.product_id
       JOIN orders o ON o.id = p.order_id
      WHERE pm.material_id = $1 AND o.season_id = $2`,
    [materialId, seasonId]
  );
  return rows[0].n;
}

const TRAY_NEGATIVE =
  "A limiting-stock (tray) quantity can't be below zero. Regular materials can go negative.";

// Whole number or null (blank / missing).
const intOrNull = (v) =>
  v === undefined || v === null || v === '' ? null : Math.floor(Number(v)) || 0;

async function fetchMaterial(db, seasonId, id) {
  const { rows } = await db.query(`${SELECT_MATERIALS} WHERE m.id = $2`, [seasonId, id]);
  return rows.length ? toMaterial(rows[0]) : null;
}

// List all materials with this season's stock.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SELECT_MATERIALS} ORDER BY m.name`, [
      req.season.id,
    ]);
    res.json(rows.map(toMaterial));
  } catch (err) {
    next(err);
  }
});

// Add a material (shared list) with its stock in the current season.
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    assertWritable(req, req.season);
    const { name, quantity, cost, starting_quantity } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Material name is required' });
    }
    const category = cleanCategory(req.body) || 'filler';
    const qty = category === 'grocery' ? 0 : Number(quantity) || 0;
    if (category === 'tray' && qty < 0) {
      return res.status(400).json({ error: TRAY_NEGATIVE });
    }
    // "Bought" defaults to the stock entered, unless given.
    const start = COUNTED.includes(category) ? intOrNull(starting_quantity) ?? qty : null;
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO materials (name, quantity, cost, is_limiting, category)
       VALUES ($1, 0, $2, $3, $4) RETURNING id`,
      [name.trim(), Number(cost) || 0, category === 'tray', category]
    );
    await client.query(
      `INSERT INTO material_stock (season_id, material_id, quantity, starting_quantity)
       VALUES ($1, $2, $3, $4)`,
      [req.season.id, rows[0].id, qty, start]
    );
    await client.query('COMMIT');
    res.status(201).json(await fetchMaterial(pool, req.season.id, rows[0].id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Edit a material. name / cost / limiting flag are shared by all seasons;
// quantity and starting quantity change only the current season's stock.
router.patch('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    assertWritable(req, req.season);
    const sid = req.season.id;
    const { name, quantity, cost, starting_quantity } = req.body;

    const cur = await fetchMaterial(pool, sid, req.params.id);
    if (!cur) return res.status(404).json({ error: 'Material not found' });

    // Trays can never be set below zero (other categories can).
    const category = cleanCategory(req.body);
    const finalCategory = category || cur.category;
    const finalQty = quantity !== undefined ? Number(quantity) || 0 : cur.quantity;
    if (finalCategory === 'tray' && finalQty < 0) {
      return res.status(400).json({ error: TRAY_NEGATIVE });
    }
    // Moving into a counted category with no "bought" amount yet: start it at
    // stock on hand + what this season already used.
    let startFill;
    if (
      category &&
      category !== cur.category &&
      COUNTED.includes(category) &&
      cur.starting_quantity == null &&
      starting_quantity === undefined
    ) {
      startFill = finalQty + (await usedInSeason(pool, sid, req.params.id));
    }

    await client.query('BEGIN');
    const sets = [];
    const vals = [];
    const put = (col, val) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (name !== undefined && String(name).trim()) put('name', String(name).trim());
    if (cost !== undefined) put('cost', Number(cost) || 0);
    if (category !== undefined) {
      put('category', category);
      put('is_limiting', category === 'tray');
    }
    if (sets.length) {
      vals.push(req.params.id);
      await client.query(
        `UPDATE materials SET ${sets.join(', ')} WHERE id = $${vals.length}`,
        vals
      );
    }

    if (quantity !== undefined || starting_quantity !== undefined || startFill !== undefined) {
      const startVal =
        starting_quantity !== undefined
          ? intOrNull(starting_quantity)
          : startFill !== undefined
          ? startFill
          : cur.starting_quantity;
      await client.query(
        `INSERT INTO material_stock (season_id, material_id, quantity, starting_quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (season_id, material_id)
         DO UPDATE SET quantity = EXCLUDED.quantity,
                       starting_quantity = EXCLUDED.starting_quantity`,
        [sid, req.params.id, finalQty, startVal]
      );
    }
    await client.query('COMMIT');
    res.json(await fetchMaterial(pool, sid, req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Delete a material. Refused while any other season's products used it, so
// past seasons' records are never altered.
router.delete('/:id', async (req, res, next) => {
  try {
    assertWritable(req, req.season);
    const { rows } = await pool.query(
      `SELECT DISTINCT s.name FROM product_materials pm
         JOIN products p ON p.id = pm.product_id
         JOIN orders o ON o.id = p.order_id
         JOIN seasons s ON s.id = o.season_id
        WHERE pm.material_id = $1 AND o.season_id <> $2`,
      [req.params.id, req.season.id]
    );
    if (rows.length) {
      return res.status(409).json({
        error: `Can't delete: products in ${rows
          .map((r) => r.name)
          .join(', ')} use this material. Keep it so past seasons stay intact.`,
      });
    }
    await pool.query('DELETE FROM materials WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
