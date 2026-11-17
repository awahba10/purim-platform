const router = require('express').Router();
const { pool } = require('../db');
const { assertWritable, seasonById } = require('../lib/seasons');

// Money spent outside inventory counts (grocery runs, packaging, gas, …).
// Each belongs to a season and counts toward that season's breakeven.
const toExpense = (e) => ({
  id: Number(e.id),
  season_id: Number(e.season_id),
  spent_on: e.spent_on instanceof Date ? e.spent_on.toISOString().slice(0, 10) : String(e.spent_on).slice(0, 10),
  kind: e.kind,
  note: e.note || '',
  amount: Number(e.amount),
});

const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const cleanKind = (v) => String(v || '').trim().slice(0, 40) || 'Other';

async function writableExpense(req, id) {
  const { rows } = await pool.query('SELECT season_id FROM expenses WHERE id = $1', [id]);
  if (!rows.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
  assertWritable(req, await seasonById(pool, rows[0].season_id));
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM expenses WHERE season_id = $1 ORDER BY spent_on DESC, id DESC`,
      [req.season.id]
    );
    res.json(rows.map(toExpense));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    assertWritable(req, req.season);
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter the amount spent' });
    const { rows } = await pool.query(
      `INSERT INTO expenses (season_id, spent_on, kind, note, amount)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5) RETURNING *`,
      [
        req.season.id,
        cleanDate(req.body.spent_on),
        cleanKind(req.body.kind),
        String(req.body.note || '').trim() || null,
        amount,
      ]
    );
    res.status(201).json(toExpense(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    await writableExpense(req, req.params.id);
    const f = req.body;
    const sets = [];
    const vals = [];
    const put = (col, val) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (f.spent_on !== undefined && cleanDate(f.spent_on)) put('spent_on', cleanDate(f.spent_on));
    if (f.kind !== undefined) put('kind', cleanKind(f.kind));
    if (f.note !== undefined) put('note', String(f.note).trim() || null);
    if (f.amount !== undefined) {
      if (!(Number(f.amount) > 0)) return res.status(400).json({ error: 'Enter the amount spent' });
      put('amount', Number(f.amount));
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE expenses SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    res.json(toExpense(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await writableExpense(req, req.params.id);
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
