// Shared helpers for products, which now always belong to an order.

const toProduct = (p) => ({
  ...p,
  cost: Number(p.cost),
  price: Number(p.price),
  profit: Number(p.price) - Number(p.cost),
  materials: (p.materials || []).map((m) => ({
    material_id: m.material_id,
    material_name: m.material_name,
    unit_cost: Number(m.unit_cost),
    quantity_used: Number(m.quantity_used),
    line_cost: Number(m.unit_cost) * Number(m.quantity_used),
  })),
});

const toOrder = (o) => ({
  ...o,
  product_count: Number(o.product_count || 0),
  total_price: Number(o.total_price || 0),
  total_cost: Number(o.total_cost || 0),
  total_profit: Number(o.total_price || 0) - Number(o.total_cost || 0),
  products: (o.products || []).map(toProduct),
});

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

// Attach a materials[] array (name + unit cost + quantity) to each product row.
async function withMaterials(db, products) {
  if (!products.length) return [];
  const { rows } = await db.query(
    `SELECT pm.product_id, pm.material_id, pm.quantity_used,
            m.name AS material_name, m.cost AS unit_cost
       FROM product_materials pm
       JOIN materials m ON m.id = pm.material_id
      WHERE pm.product_id = ANY($1::int[])
      ORDER BY m.name`,
    [products.map((p) => p.id)]
  );
  const byProduct = {};
  for (const r of rows) (byProduct[r.product_id] || (byProduct[r.product_id] = [])).push(r);
  return products.map((p) => ({ ...p, materials: byProduct[p.id] || [] }));
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

  const { rows } = await client.query(
    `INSERT INTO products (order_id, name, address, notes, gift_message, cost, price)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      orderId,
      name,
      (input.address || '').trim() || null,
      (input.notes || '').trim() || null,
      (input.gift_message || '').trim() || null,
      cost,
      Number(input.price) || 0,
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
  cleanMaterials,
  withMaterials,
  suggestedCost,
  insertProduct,
  restoreProductMaterials,
  fetchOrderFull,
};
