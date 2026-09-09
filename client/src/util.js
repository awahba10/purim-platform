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
  // Section 1 — Product Details
  name: '',
  price: '',
  cost: '',
  costTouched: false,
  materials: [], // [{ material_id, quantity_used }]
  // Section 2 — Fulfillment
  fulfillment: 'Delivery',
  address: '',
  delivery_location: '',
  delivery_instructions: '',
  delivery_charge: '0',
  dcOther: false,
  // Section 3 — Optional add-ons (each behind its own toggle)
  recipientOn: false,
  recipient_name: '',
  giftOn: false,
  gift_message: '',
  notesOn: false,
  notes: '',
});

// A saved product (from the API) -> an editable draft.
export const productToDraft = (p) => ({
  _key: nextKey(),
  name: p.name || '',
  price: String(p.price ?? ''),
  cost: String(p.cost ?? ''),
  costTouched: true,
  materials: (p.materials || []).map((m) => ({
    material_id: m.material_id,
    quantity_used: m.quantity_used,
  })),
  fulfillment: p.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery',
  address: p.address || '',
  delivery_location: p.delivery_location || '',
  delivery_instructions: p.delivery_instructions || '',
  delivery_charge: String(p.delivery_charge ?? '0'),
  dcOther: !isQuickCharge(p.delivery_charge ?? 0),
  recipientOn: !!(p.recipient_name && p.recipient_name.trim()),
  recipient_name: p.recipient_name || '',
  giftOn: !!(p.gift_message && p.gift_message.trim()),
  gift_message: p.gift_message || '',
  notesOn: !!(p.notes && p.notes.trim()),
  notes: p.notes || '',
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
    delivery_instructions: pickup ? '' : d.delivery_instructions.trim(),
    delivery_charge: pickup ? 0 : Number(d.delivery_charge) || 0,
    recipient_name: d.recipientOn ? d.recipient_name.trim() : '',
    gift_message: d.giftOn ? d.gift_message.trim() : '',
    notes: d.notesOn ? d.notes.trim() : '',
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

// Validate a product draft before it can be added/saved. Returns an error
// string, or null if it's fine.
export const validateProductDraft = (d) => {
  if (!d.name.trim()) return 'Give the product a name.';
  if (d.fulfillment !== 'Pickup') {
    if (!d.address.trim()) return 'Delivery products need an address.';
    if (!d.delivery_location.trim()) {
      return 'Delivery products need a delivery location.';
    }
    if (d.dcOther && String(d.delivery_charge).trim() === '') {
      return 'Enter the custom delivery charge.';
    }
  }
  if (d.recipientOn && !d.recipient_name.trim()) {
    return 'Recipient name is turned on but empty — fill it in or turn it off.';
  }
  if (d.giftOn && !d.gift_message.trim()) {
    return 'Gift message is turned on but empty — fill it in or turn it off.';
  }
  if (d.notesOn && !d.notes.trim()) {
    return 'Notes are turned on but empty — fill it in or turn it off.';
  }
  return null;
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

// Build one Google Maps multi-stop directions URL from an ordered list of
// address strings. First address is the origin, the rest are stops in order.
export function buildMapsRouteUrl(addresses) {
  const stops = (addresses || [])
    .map((a) => (a == null ? '' : String(a).replace(/\s+/g, ' ').trim()))
    .filter(Boolean);
  if (!stops.length) return null;
  const path = stops.map((s) => encodeURIComponent(s)).join('/');
  return `https://www.google.com/maps/dir/${path}`;
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

// --- Filtering ---------------------------------------------------------------

// Unique, sorted, non-empty strings.
export const distinctSorted = (arr) =>
  [...new Set((arr || []).map((v) => (v == null ? '' : String(v))).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

// items: array. categories: [{ key, match(item, selectedValues[]) }].
// state: { [key]: string[] }. A category with no selection is ignored; within a
// category the values are OR'd; across categories they are AND'd.
export function filterItems(items, categories, state) {
  const active = (categories || []).filter(
    (c) => (state[c.key] || []).length > 0
  );
  if (!active.length) return items;
  return items.filter((item) =>
    active.every((c) => c.match(item, state[c.key]))
  );
}

// Bucket a free-text "way of contact" string into a coarse channel.
export function classifyContact(raw) {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'None';
  if (/whats\s*app|\bwa\b/.test(s)) return 'WhatsApp';
  if (/insta|\big\b|instagram/.test(s) || /^@[a-z0-9._]+$/.test(s)) return 'Instagram';
  if (/e-?mail/.test(s) || /@[^\s@]+\.[a-z]{2,}/.test(s)) return 'Email';
  if (/text|sms|imessage|message/.test(s)) return 'Text';
  if (/phone|call|\btel\b|mobile|cell/.test(s) || /^\+?[\d()\-.\s]{6,}$/.test(s))
    return 'Phone';
  return 'Other';
}

// --- Grouping (Financials breakdowns) --------------------------------------

// Group product rows by keyFn; sum revenue/cost/profit/delivery, count distinct
// orders and line items. Returns [{ label, count, lineItems, revenue, cost,
// profit, delivery }].
export function groupProductRows(list, keyFn) {
  const map = new Map();
  for (const p of list) {
    const k = keyFn(p);
    let g = map.get(k);
    if (!g) {
      g = { label: k, orders: new Set(), lineItems: 0, revenue: 0, cost: 0, profit: 0, delivery: 0 };
      map.set(k, g);
    }
    g.orders.add(p.order_id);
    g.lineItems += 1;
    g.revenue += Number(p.price) || 0;
    g.cost += Number(p.cost) || 0;
    g.profit += Number(p.profit) || 0;
    g.delivery += Number(p.delivery_charge) || 0;
  }
  return [...map.values()].map((g) => ({
    label: g.label,
    count: g.orders.size,
    lineItems: g.lineItems,
    revenue: g.revenue,
    cost: g.cost,
    profit: g.profit,
    delivery: g.delivery,
  }));
}

// Copy text to the clipboard, with fallbacks for older / non-secure contexts.
export async function copyText(text) {
  const value = text == null ? '' : String(text);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch {
    /* fall through */
  }
  window.prompt('Copy:', value);
  return false;
}
