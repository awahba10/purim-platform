const router = require('express').Router();
const { pool } = require('../db');

const NUMERIC_FIELDS = [
  'page_w',
  'page_h',
  'label_w',
  'label_h',
  'margin_top',
  'margin_left',
  'gap_x',
  'gap_y',
];
const INT_FIELDS = ['cols', 'rows'];

const toTemplate = (t) => {
  const out = { key: t.key, name: t.name };
  for (const f of NUMERIC_FIELDS) out[f] = Number(t[f]);
  for (const f of INT_FIELDS) out[f] = Number(t[f]);
  return out;
};

// List both label templates.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM label_templates ORDER BY key');
    res.json(rows.map(toTemplate));
  } catch (err) {
    next(err);
  }
});

// Edit one template (by key: 'gift' or 'shipping').
router.patch('/:key', async (req, res, next) => {
  try {
    const f = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    const put = (col, val) => {
      sets.push(`${col} = $${i++}`);
      vals.push(val);
    };
    if (f.name !== undefined && String(f.name).trim()) {
      put('name', String(f.name).trim());
    }
    for (const col of NUMERIC_FIELDS) {
      if (f[col] !== undefined && f[col] !== '' && f[col] !== null) {
        put(col, Number(f[col]) || 0);
      }
    }
    for (const col of INT_FIELDS) {
      if (f[col] !== undefined && f[col] !== '' && f[col] !== null) {
        put(col, Math.max(1, Math.floor(Number(f[col]) || 1)));
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.key);
    const { rows } = await pool.query(
      `UPDATE label_templates SET ${sets.join(', ')} WHERE key = $${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(toTemplate(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
