export const money = (n) =>
  `$${(Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const qtyOf = (x) => Math.max(1, Math.floor(Number(x) || 1));

let keySeq = 0;
const nextKey = () => `d${Date.now().toString(36)}${(keySeq++).toString(36)}`;

// Suggested product cost = sum(material unit cost * quantity used).
export const suggestedCostOf = (selected, catalog) => {
  const byId = {};
  for (const m of catalog) byId[m.id] = m;
  return (selected || []).reduce((sum, s) => {
    const m = byId[s.material_id];
    return sum + (m ? Number(m.cost) : 0) * qtyOf(s.quantity_used);
  }, 0);
};

export const newProductDraft = () => ({
  _key: nextKey(),
  name: '',
  address: '',
  notes: '',
  gift_message: '',
  price: '',
  cost: '',
  costTouched: false,
  materials: [], // [{ material_id, quantity_used }]
});

// A saved product (from the API) -> an editable draft.
export const productToDraft = (p) => ({
  _key: nextKey(),
  name: p.name || '',
  address: p.address || '',
  notes: p.notes || '',
  gift_message: p.gift_message || '',
  price: String(p.price ?? ''),
  cost: String(p.cost ?? ''),
  costTouched: true,
  materials: (p.materials || []).map((m) => ({
    material_id: m.material_id,
    quantity_used: m.quantity_used,
  })),
});

// A draft -> the API payload for a product.
export const draftToPayload = (d, catalog) => ({
  name: d.name.trim(),
  address: d.address.trim(),
  notes: d.notes.trim(),
  gift_message: d.gift_message.trim(),
  price: Number(d.price) || 0,
  cost:
    d.cost === '' || d.cost === null
      ? round2(suggestedCostOf(d.materials, catalog))
      : Number(d.cost) || 0,
  materials: d.materials.map((m) => ({
    material_id: m.material_id,
    quantity_used: qtyOf(m.quantity_used),
  })),
});
