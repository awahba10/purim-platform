import { jsPDF } from 'jspdf';
import giftTemplateUrl from './assets/gift-label-template.png';

// The clear text band inside the gift background, as fractions of the label.
const GIFT_BOX = { x: 0.1, y: 0.34, w: 0.8, h: 0.32 };

export function slotsPerSheet(t) {
  return Math.max(1, t.cols * t.rows);
}

// Where a product should be shipped/addressed to.
export function labelRecipient(p) {
  return (p.recipient_name && p.recipient_name.trim()) || p.customer_name || '';
}

let giftImgPromise = null;
export function loadGiftImage() {
  if (!giftImgPromise) {
    giftImgPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = giftTemplateUrl;
    });
  }
  return giftImgPromise;
}

// Find the largest font size (in pt) at which all paragraphs, wrapped to `boxW`
// inches, fit within `boxH` inches. Returns { size, lineH (in), lines[] }.
function fitText(doc, paragraphs, boxW, boxH, { max = 12, min = 4 } = {}) {
  doc.setFont('helvetica', 'normal');
  const build = (size) => {
    doc.setFontSize(size);
    const lineH = (size / 72) * 1.2; // inches
    let lines = [];
    for (const para of paragraphs) {
      if (para === '') {
        lines.push('');
        continue;
      }
      lines = lines.concat(doc.splitTextToSize(String(para), boxW));
    }
    return { size, lineH, lines };
  };
  for (let size = max; size >= min; size -= 0.5) {
    const r = build(size);
    if (r.lines.length * r.lineH <= boxH) return r;
  }
  return build(min);
}

function drawShippingLabel(doc, x, y, w, h, p) {
  const pad = 0.09;
  const bx = x + pad;
  const bw = w - 2 * pad;
  const bh = h - 2 * pad;

  const paras = [`#${p.ticket_number || p.id}`, labelRecipient(p)];
  if (p.delivery_location) paras.push(p.delivery_location);
  if (p.address) {
    for (const line of String(p.address).split(/\r?\n/)) {
      if (line.trim()) paras.push(line.trim());
    }
  }
  if (p.delivery_instructions && p.delivery_instructions.trim()) {
    paras.push(p.delivery_instructions.trim());
  }

  const fit = fitText(doc, paras, bw, bh, { max: 9, min: 4 });
  doc.setTextColor(0, 0, 0);
  let ty = y + pad + fit.lineH * 0.85;
  for (const line of fit.lines) {
    doc.text(line, bx, ty);
    ty += fit.lineH;
  }
}

function drawGiftLabel(doc, x, y, w, h, p, img) {
  doc.addImage(img, 'PNG', x, y, w, h, 'giftbg', 'FAST');

  const bx = x + GIFT_BOX.x * w;
  const by = y + GIFT_BOX.y * h;
  const bw = GIFT_BOX.w * w;
  const bh = GIFT_BOX.h * h;

  const paras = [
    `To: ${labelRecipient(p)}`,
    `From: ${p.customer_name || ''}`,
    '',
  ];
  if (p.gift_message && p.gift_message.trim()) {
    for (const line of String(p.gift_message).split(/\r?\n/)) paras.push(line);
  }

  const fit = fitText(doc, paras, bw, bh, { max: 13, min: 5 });
  doc.setTextColor(0, 0, 0);
  const blockH = fit.lines.length * fit.lineH;
  let ty = by + (bh - blockH) / 2 + fit.lineH * 0.85;
  for (const line of fit.lines) {
    doc.text(line, x + w / 2, ty, { align: 'center' });
    ty += fit.lineH;
  }
}

// Build the label PDF. `kind` is 'gift' | 'shipping'. `startSlot` is 0-based,
// row-major; products flow from there and onto new sheets as needed.
export async function generateLabelPdf({ kind, products, template: t, startSlot = 0 }) {
  const doc = new jsPDF({ unit: 'in', format: [t.page_w, t.page_h] });
  const per = slotsPerSheet(t);
  const img = kind === 'gift' ? await loadGiftImage() : null;

  products.forEach((p, i) => {
    const abs = startSlot + i;
    const slotOnSheet = abs % per;
    if (i > 0 && slotOnSheet === 0) doc.addPage([t.page_w, t.page_h]);

    const col = slotOnSheet % t.cols;
    const row = Math.floor(slotOnSheet / t.cols);
    const ox = t.margin_left + col * (t.label_w + t.gap_x);
    const oy = t.margin_top + row * (t.label_h + t.gap_y);

    if (kind === 'gift') drawGiftLabel(doc, ox, oy, t.label_w, t.label_h, p, img);
    else drawShippingLabel(doc, ox, oy, t.label_w, t.label_h, p);
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`purim-${kind}-labels-${stamp}.pdf`);
}
