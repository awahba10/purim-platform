// Shared helpers for products, which now always belong to an order.

const mapMaterials = (list) =>
  (list || []).map((m) => ({
    material_id: m.material_id,
    material_name: m.material_name,
    unit_cost: Number(m.unit_cost),
    quantity_used: Number(m.quantity_used),
    line_cost: Number(m.unit_cost) * Number(m.quantity_used),
  }));

const toProduct = (p) => ({
  ...p,
  cost: Number(p.cost),
  price: Number(p.price),
  profit: Number(p.price) - Number(p.cost),
  is_made: Boolean(p.is_made),
  fulfillment: p.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery',
  delivery_location: p.delivery_location || null,
  delivery_charge: Number(p.delivery_charge || 0),
  materials: mapMaterials(p.materials),
});

function progressComputed(productCount, madeCount) {
  if (madeCount === 0) return 'None Made';
  if (productCount > 0 && madeCount === productCount) return 'All Made';
  return 'Some Made';
}

const toOrder = (o) => {
  const productCount = Number(o.product_count || 0);
  const madeCount = Number(o.made_count || 0);
  const computed = progressComputed(productCount, madeCount);
  const override = o.progress_override != null ? o.progress_override : null;
  return {
    ...o,
    product_count: productCount,
    made_count: madeCount,
    total_price: Number(o.total_price || 0),
    total_cost: Number(o.total_cost || 0),
    total_profit: Number(o.total_price || 0) - Number(o.total_cost || 0),
    progress_computed: computed,
    progress_override: override,
    progress_status: override != null ? override : computed,
    progress_is_auto: override == null,
    products: (o.products || []).map(toProduct),
  };
};

// Normalize an incoming materials array: dedupe by id, whole quantities >= 1.
function cleanMaterials(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const m of input) {
    const id = Number(m && m.material_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      material_id: id,
      quantity_used: Math.max(1, Math.floor(Number(m.quantity_used) || 1)),
    });
  }
  return out;
}

// Attach a materials[] array (name + unit cost + quantity) to each row, joining
// through a link table. Works for products (product_materials) and presets
// (preset_materials).
async function attachMaterials(db, rows, { linkTable, fk }) {
  if (!rows.length) return [];
  const { rows: links } = await db.query(
    `SELECT lk.${fk} AS owner_id, lk.material_id, lk.quantity_used,
            m.name AS material_name, m.cost AS unit_cost
       FROM ${linkTable} lk
       JOIN materials m ON m.id = lk.material_id
      WHERE lk.${fk} = ANY($1::int[])
      ORDER BY m.name`,
    [rows.map((r) => r.id)]
  );
  const byOwner = {};
  for (const r of links) (byOwner[r.owner_id] || (byOwner[r.owner_id] = [])).push(r);
  return rows.map((r) => ({ ...r, materials: byOwner[r.id] || [] }));
}

// Attach a materials[] array to product rows.
function withMaterials(db, products) {
  return attachMaterials(db, products, {
    linkTable: 'product_materials',
    fk: 'product_id',
  });
}

// Suggested cost = sum(material unit cost * quantity used).
async function suggestedCost(db, materials) {
  if (!materials.length) return 0;
  const { rows } = await db.query(
    'SELECT id, cost FROM materials WHERE id = ANY($1::int[])',
    [materials.map((m) => m.material_id)]
  );
  const costById = Object.fromEntries(rows.map((r) => [r.id, Number(r.cost)]));
  return materials.reduce(
    (sum, m) => sum + (costById[m.material_id] || 0) * m.quantity_used,
    0
  );
}

// Insert one product under an order, link its materials, decrement stock.
async function insertProduct(client, orderId, input) {
  const name = (input.name || '').trim();
  if (!name) {
    throw Object.assign(new Error('Every product needs a name'), { status: 400 });
  }
  const materials = cleanMaterials(input.materials);

  const cost =
    input.cost === undefined || input.cost === null || input.cost === ''
      ? await suggestedCost(client, materials)
      : Number(input.cost) || 0;

  const isPickup = input.fulfillment === 'Pickup';
  const fulfillment = isPickup ? 'Pickup' : 'Delivery';
  const address = isPickup ? null : (input.address || '').trim() || null;
  const deliveryLocation = isPickup
    ? null
    : (input.delivery_location || '').trim() || null;
  const deliveryCharge = isPickup ? 0 : Number(input.delivery_charge) || 0;

  if (!isPickup && !address) {
    throw Object.assign(
      new Error('Delivery products need an address'),
      { status: 400 }
    );
  }

  const { rows } = await client.query(
    `INSERT INTO products
       (order_id, name, address, notes, gift_message, cost, price,
        fulfillment, delivery_location, delivery_charge)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      orderId,
      name,
      address,
      (input.notes || '').trim() || null,
      (input.gift_message || '').trim() || null,
      cost,
      Number(input.price) || 0,
      fulfillment,
      deliveryLocation,
      deliveryCharge,
    ]
  );
  const productId = rows[0].id;

  for (const m of materials) {
    await client.query(
      `INSERT INTO product_materials (product_id, material_id, quantity_used)
       VALUES ($1, $2, $3)`,
      [productId, m.material_id, m.quantity_used]
    );
    await client.query('UPDATE materials SET quantity = quantity - $1 WHERE id = $2', [
      m.quantity_used,
      m.material_id,
    ]);
  }
  return productId;
}

// Add back the stock a product's materials consumed.
async function restoreProductMaterials(client, productId) {
  const { rows } = await client.query(
    'SELECT material_id, quantity_used FROM product_materials WHERE product_id = $1',
    [productId]
  );
  for (const r of rows) {
    await client.query('UPDATE materials SET quantity = quantity + $1 WHERE id = $2', [
      Number(r.quantity_used),
      r.material_id,
    ]);
  }
}

async function fetchOrderFull(db, orderId) {
  const { rows: orders } = await db.query(
    `SELECT o.*,
            (SELECT COUNT(*) FROM products p WHERE p.order_id = o.id) AS product_count,
            (SELECT COUNT(*) FROM products p WHERE p.order_id = o.id AND p.is_made) AS made_count,
            (SELECT COALESCE(SUM(p.price), 0) FROM products p WHERE p.order_id = o.id) AS total_price,
            (SELECT COALESCE(SUM(p.cost), 0) FROM products p WHERE p.order_id = o.id) AS total_cost
       FROM orders o WHERE o.id = $1`,
    [orderId]
  );
  if (!orders.length) return null;
  const { rows: products } = await db.query(
    'SELECT * FROM products WHERE order_id = $1 ORDER BY id',
    [orderId]
  );
  const withMats = await withMaterials(db, products);
  return toOrder({ ...orders[0], products: withMats });
}

module.exports = {
  toProduct,
  toOrder,
  mapMaterials,
  cleanMaterials,
  attachMaterials,
  withMaterials,
  suggestedCost,
  insertProduct,
  restoreProductMaterials,
  fetchOrderFull,
};
