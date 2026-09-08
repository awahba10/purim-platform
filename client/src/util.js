export const money = (n) =>
  `$${(Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const qtyOf = (x) => Math.max(1, Math.floor(Number(x) || 1));

export const DELIVERY_QUICK = [0, 5, 10, 15];
const isQuickCharge = (n) => DELIVERY_QUICK.includes(Number(n));

let keySeq = 0;
const nextKey = () => `d${Date.now().toString(36)}${(keySeq++).toString(36)}`;
export const newDraftKey = nextKey;

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
  fulfillment: 'Delivery',
  address: '',
  delivery_location: '',
  delivery_charge: '0',
  dcOther: false,
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
  fulfillment: p.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery',
  address: p.address || '',
  delivery_location: p.delivery_location || '',
  delivery_charge: String(p.delivery_charge ?? '0'),
  dcOther: !isQuickCharge(p.delivery_charge ?? 0),
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

// The fields a premade preset fills into a product draft. Everything stays
// editable afterward, same as a from-scratch product.
export const presetToDraftPatch = (preset) => ({
  name: preset.name || '',
  price: String(preset.price ?? ''),
  cost: String(preset.cost ?? ''),
  costTouched: true,
  materials: (preset.materials || []).map((m) => ({
    material_id: m.material_id,
    quantity_used: m.quantity_used,
  })),
});

// A draft -> the API payload for a product.
export const draftToPayload = (d, catalog) => {
  const pickup = d.fulfillment === 'Pickup';
  return {
    name: d.name.trim(),
    fulfillment: pickup ? 'Pickup' : 'Delivery',
    address: pickup ? '' : d.address.trim(),
    delivery_location: pickup ? '' : d.delivery_location.trim(),
    delivery_charge: pickup ? 0 : Number(d.delivery_charge) || 0,
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
  };
};

// --- CSV export ---
export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const r of rows) {
    lines.push(columns.map((c) => esc(c.get ? c.get(r) : r[c.key])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCSV(filename, csv) {
  // Prepend a BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
