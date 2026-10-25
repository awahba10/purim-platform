const router = require('express').Router();
const { pool } = require('../db');
const { mapMaterials, cleanMaterials, attachMaterials } = require('../lib/products');

const LINK = { linkTable: 'preset_materials', fk: 'preset_id' };

// Inventory is derived: the anchor tray's current stock. Only counts while the
// anchor is still flagged as limiting stock; otherwise the preset has no anchor.
const SELECT_PRESET = `
  SELECT ps.*,
         CASE WHEN am.is_limiting THEN ps.anchor_material_id END AS anchor_id,
         CASE WHEN am.is_limiting THEN am.name END AS anchor_name,
         CASE WHEN am.is_limiting THEN am.quantity END AS anchor_quantity
    FROM presets ps
    LEFT JOIN materials am ON am.id = ps.anchor_material_id
`;

const toPreset = (p) => {
  const materials = mapMaterials(p.materials);
  const anchored = p.anchor_id != null;
  return {
    ...p,
    price: Number(p.price),
    cost: materials.reduce((sum, m) => sum + m.line_cost, 0),
    anchor_material_id: anchored ? Number(p.anchor_id) : null,
    anchor_name: anchored ? p.anchor_name : null,
    inventory: anchored ? Number(p.anchor_quantity) : null,
    materials,
  };
};

// Validate an incoming anchor id: must be a limiting-stock material (or null).
async function cleanAnchor(db, raw) {
  if (raw === undefined) return undefined;
  const id = Number(raw);
  if (!id) return null;
  const { rows } = await db.query(
    'SELECT id FROM materials WHERE id = $1 AND is_limiting',
    [id]
  );
  if (!rows.length) {
    throw Object.assign(new Error('Anchor tray must be a limiting-stock material'), {
      status: 400,
    });
  }
  return id;
}

// The anchor tray is always one of the preset's materials (quantity 1 if added).
function withAnchor(materials, anchorId) {
  const list = Array.isArray(materials) ? [...materials] : [];
  if (anchorId && !list.some((m) => Number(m && m.material_id) === anchorId)) {
    list.push({ material_id: anchorId, quantity_used: 1 });
  }
  return list;
}

async function fetchPreset(db, id) {
  const { rows } = await db.query(`${SELECT_PRESET} WHERE ps.id = $1`, [id]);
  if (!rows.length) return null;
  const withMats = await attachMaterials(db, rows, LINK);
  return toPreset(withMats[0]);
}

async function replaceLinks(client, presetId, materials) {
  await client.query('DELETE FROM preset_materials WHERE preset_id = $1', [presetId]);
  for (const m of cleanMaterials(materials)) {
    await client.query(
      `INSERT INTO preset_materials (preset_id, material_id, quantity_used)
       VALUES ($1, $2, $3)`,
      [presetId, m.material_id, m.quantity_used]
    );
  }
}

// LIST every preset with its materials and computed cost.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SELECT_PRESET} ORDER BY ps.name`);
    const withMats = await attachMaterials(pool, rows, LINK);
    res.json(withMats.map(toPreset));
  } catch (err) {
    next(err);
  }
});

// CREATE a preset.
router.post('/', async (req, res, next) => {
  const { name, price, materials } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Preset name is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const anchorId = (await cleanAnchor(client, req.body.anchor_material_id)) || null;
    const { rows } = await client.query(
      'INSERT INTO presets (name, price, anchor_material_id) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), Number(price) || 0, anchorId]
    );
    await replaceLinks(client, rows[0].id, withAnchor(materials, anchorId));
    await client.query('COMMIT');
    res.status(201).json(await fetchPreset(pool, rows[0].id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// EDIT a preset. If `materials` is an array it replaces the whole link list.
router.patch('/:id', async (req, res, next) => {
  const { name, price, materials } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id FROM presets WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Preset not found' });
    }

    const anchorId = await cleanAnchor(client, req.body.anchor_material_id);
    const sets = [];
    const vals = [];
    let i = 1;
    if (anchorId !== undefined) {
      sets.push(`anchor_material_id = $${i++}`);
      vals.push(anchorId);
    }
    if (name !== undefined && String(name).trim()) {
      sets.push(`name = $${i++}`);
      vals.push(String(name).trim());
    }
    if (price !== undefined && price !== '' && price !== null) {
      sets.push(`price = $${i++}`);
      vals.push(Number(price) || 0);
    }
    if (sets.length) {
      vals.push(req.params.id);
      await client.query(
        `UPDATE presets SET ${sets.join(', ')} WHERE id = $${i}`,
        vals
      );
    }
    if (Array.isArray(materials)) {
      await replaceLinks(client, req.params.id, withAnchor(materials, anchorId));
    }
    await client.query('COMMIT');
    res.json(await fetchPreset(pool, req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE a preset (links cascade).
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM presets WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
