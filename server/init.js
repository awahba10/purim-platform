const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function init() {
  // One-time upgrade from the original schema (orders held a single product and
  // an "instagram" column; products were a standalone catalog). The order/product
  // shape changed enough that the cleanest path is to drop those three tables and
  // let schema.sql recreate them. Materials (and their stock) are kept.
  const legacy = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'instagram'
  `);
  if (legacy.rowCount > 0) {
    await pool.query(`
      DROP TABLE IF EXISTS product_materials CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
    `);
    console.log('[init] Upgraded schema: rebuilt orders/products tables.');
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  await migrateToSeasons();
  await adoptStragglers();

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM materials');
  if (rows[0].n === 0) {
    await seedMaterials();
  }

  const { rows: dl } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM delivery_locations'
  );
  if (dl[0].n === 0) {
    for (const [name, cost] of [
      ['Local (same neighborhood)', 5],
      ['Across town', 10],
      ['Next town over', 15],
    ]) {
      await pool.query(
        'INSERT INTO delivery_locations (name, cost) VALUES ($1, $2)',
        [name, cost]
      );
    }
    console.log('[init] Seeded sample delivery locations.');
  }

  const { rows: lt } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM label_templates'
  );
  if (lt[0].n === 0) {
    // page_w, page_h, label_w, label_h, cols, rows, margin_top, margin_left, gap_x, gap_y
    await pool.query(
      `INSERT INTO label_templates
         (key, name, page_w, page_h, label_w, label_h, cols, rows, margin_top, margin_left, gap_x, gap_y)
       VALUES
         ('gift', 'Gift Label (Avery 94101, 3x3 in)', 8.5, 11, 3, 3, 2, 3, 1, 1.25, 0.5, 0),
         ('shipping', 'Shipping Label (Avery 5160, 1 x 2-5/8 in)', 8.5, 11, 2.625, 1, 3, 10, 0.5, 0.1875, 0.125, 0)`
    );
    console.log('[init] Seeded label templates (gift, shipping).');
  }
}

const FIRST_SEASON = 'Purim 2027';

// One-time, non-destructive move to seasons. Runs only while no season exists:
// creates "Purim 2027" (Active) and assigns every existing order, batch and
// material stock count (incl. trays' starting quantities) to it. Nothing is
// deleted, renumbered or rewritten — ticket numbers stay as they are. Counts
// are checked before/after inside the transaction; any mismatch rolls the
// whole thing back. The report is saved in app_meta and logged.
async function migrateToSeasons() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize with any other starting instance, then re-check.
    await client.query('LOCK TABLE seasons IN EXCLUSIVE MODE');
    const { rows: existing } = await client.query('SELECT COUNT(*)::int AS n FROM seasons');
    if (existing[0].n > 0) {
      await client.query('COMMIT');
      return;
    }

    const count = async (sql) => (await client.query(sql)).rows[0];
    const before = {
      orders: (await count('SELECT COUNT(*)::int AS n FROM orders')).n,
      products: (await count('SELECT COUNT(*)::int AS n FROM products')).n,
      batches: (await count('SELECT COUNT(*)::int AS n FROM batches')).n,
      materials: (await count('SELECT COUNT(*)::int AS n FROM materials')).n,
      stockTotal: (await count('SELECT COALESCE(SUM(quantity), 0)::int AS n FROM materials')).n,
      startingTotal: (
        await count(
          'SELECT COALESCE(SUM(starting_quantity), 0)::int AS n FROM materials WHERE is_limiting'
        )
      ).n,
    };

    const { rows: ins } = await client.query(
      `INSERT INTO seasons (name, status) VALUES ($1, 'Active') RETURNING id`,
      [FIRST_SEASON]
    );
    const sid = ins[0].id;
    await client.query('UPDATE orders SET season_id = $1 WHERE season_id IS NULL', [sid]);
    await client.query('UPDATE batches SET season_id = $1 WHERE season_id IS NULL', [sid]);
    await client.query(
      `INSERT INTO material_stock (season_id, material_id, quantity, starting_quantity)
       SELECT $1, id, quantity, CASE WHEN is_limiting THEN starting_quantity END
         FROM materials
       ON CONFLICT DO NOTHING`,
      [sid]
    );

    const q1 = async (sql) => (await client.query(sql, [sid])).rows[0].n;
    const after = {
      orders: await q1('SELECT COUNT(*)::int AS n FROM orders WHERE season_id = $1'),
      products: await q1(
        `SELECT COUNT(*)::int AS n FROM products p JOIN orders o ON o.id = p.order_id
          WHERE o.season_id = $1`
      ),
      batches: await q1('SELECT COUNT(*)::int AS n FROM batches WHERE season_id = $1'),
      materials: await q1('SELECT COUNT(*)::int AS n FROM material_stock WHERE season_id = $1'),
      stockTotal: await q1(
        'SELECT COALESCE(SUM(quantity), 0)::int AS n FROM material_stock WHERE season_id = $1'
      ),
      startingTotal: await q1(
        `SELECT COALESCE(SUM(starting_quantity), 0)::int AS n FROM material_stock
          WHERE season_id = $1`
      ),
    };

    const ok =
      after.orders === before.orders &&
      after.products === before.products &&
      after.batches === before.batches &&
      after.materials === before.materials &&
      after.stockTotal === before.stockTotal &&
      after.startingTotal === before.startingTotal;
    const report = {
      season: FIRST_SEASON,
      ran_at: new Date().toISOString(),
      before,
      after,
      ok,
    };
    if (!ok) {
      throw new Error('Season migration count mismatch: ' + JSON.stringify(report));
    }
    await client.query(
      `INSERT INTO app_meta (key, value) VALUES ('season_migration', $1)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(report)]
    );
    await client.query('COMMIT');
    console.log('[init] Season migration complete:', JSON.stringify(report));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Safety net: anything written without a season (e.g. by the previous app
// version during a deploy) joins the Active season.
async function adoptStragglers() {
  const { rows } = await pool.query(
    `SELECT id FROM seasons WHERE status = 'Active' ORDER BY created_at DESC, id DESC LIMIT 1`
  );
  if (!rows.length) return;
  const sid = rows[0].id;
  const o = await pool.query('UPDATE orders SET season_id = $1 WHERE season_id IS NULL', [sid]);
  const b = await pool.query('UPDATE batches SET season_id = $1 WHERE season_id IS NULL', [sid]);
  if (o.rowCount || b.rowCount) {
    console.log(`[init] Attached ${o.rowCount} orders / ${b.rowCount} batches to the Active season.`);
  }
}

async function seedMaterials() {
  // name, quantity in stock, cost per unit
  const rows = [
    ['Tray', 60, 1.75],
    ['Cellophane wrap', 200, 0.2],
    ['Ribbon', 150, 0.35],
    ['Gift tag', 200, 0.1],
    ['Chocolate bar', 120, 1.25],
    ['Bag of candy', 120, 1.5],
    ['Bottle of grape juice', 80, 2.4],
    ['Hamantaschen (dozen)', 60, 6.0],
  ];
  for (const [name, quantity, cost] of rows) {
    await pool.query(
      'INSERT INTO materials (name, quantity, cost) VALUES ($1, $2, $3)',
      [name, quantity, cost]
    );
  }
  // Give the seeded stock to the Active season (fresh installs only).
  await pool.query(
    `INSERT INTO material_stock (season_id, material_id, quantity)
     SELECT s.id, m.id, m.quantity FROM materials m
       CROSS JOIN (SELECT id FROM seasons WHERE status = 'Active'
                    ORDER BY created_at DESC, id DESC LIMIT 1) s
     ON CONFLICT DO NOTHING`
  );
  console.log('[init] Seeded sample materials.');
}

module.exports = { init };
