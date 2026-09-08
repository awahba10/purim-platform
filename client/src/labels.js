import { jsPDF } from 'jspdf';
import giftTemplateUrl from './assets/gift-label-template.png';
import dancingScriptUrl from './fonts/DancingScript-Regular.ttf';

// The clear text band inside the gift background, as fractions of the label.
const GIFT_BOX = { x: 0.1, y: 0.34, w: 0.8, h: 0.32 };
const GIFT_FONT = 'DancingScript';
const DEFAULT_GIFT_MESSAGE = 'Chag Purim Sameach!';

// Gift-label sizing (points).
const GIFT_MAX_PT = 16;
const GIFT_MIN_ONELINE_PT = 9; // readable floor for a single "To … From …" line
const GIFT_MIN_PT = 6; // absolute floor for anything on the gift label
const LINE_FACTOR = 1.25;
const lineHeightIn = (pt) => (pt / 72) * LINE_FACTOR;

export function slotsPerSheet(t) {
  return Math.max(1, t.cols * t.rows);
}

// Where a product should be shipped/addressed to (shipping label rule: fall back
// to the customer name when no recipient name was entered).
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

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

let fontBase64Promise = null;
function loadDancingScriptBase64() {
  if (!fontBase64Promise) {
    fontBase64Promise = fetch(dancingScriptUrl)
      .then((r) => r.arrayBuffer())
      .then(arrayBufferToBase64);
  }
  return fontBase64Promise;
}

async function registerGiftFont(doc) {
  const b64 = await loadDancingScriptBase64();
  doc.addFileToVFS('DancingScript-Regular.ttf', b64);
  doc.addFont('DancingScript-Regular.ttf', GIFT_FONT, 'normal');
}

// ---- Shipping label: uniform auto-shrink over all lines ----
function fitText(doc, paragraphs, boxW, boxH, opts = {}) {
  const { max = 12, min = 4, font = 'helvetica' } = opts;
  doc.setFont(font, 'normal');
  const build = (size) => {
    doc.setFontSize(size);
    const lineH = (size / 72) * LINE_FACTOR;
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

// ---- Gift label To/From fitting ----

// Largest size in [minPt, maxPt] (0.5 steps) at which every string fits `boxW`.
function widestSizeForWidth(doc, strings, boxW, maxPt, minPt) {
  for (let s = maxPt; s >= minPt; s -= 0.5) {
    doc.setFontSize(s);
    if (strings.every((str) => doc.getTextWidth(str) <= boxW)) return s;
  }
  return null;
}

// Largest size (<= capPt, >= floorPt) at which the fixed lines + blank + wrapped
// message all fit within `boxH`. Returns { size, msgLines }.
function wholeBlockSize(doc, fixedLines, message, boxW, boxH, capPt, floorPt) {
  const measure = (s) => {
    doc.setFontSize(s);
    const fixedCount = fixedLines.reduce(
      (n, l) => n + doc.splitTextToSize(l, boxW).length,
      0
    );
    const msgLines = message ? doc.splitTextToSize(String(message), boxW) : [];
    const total = fixedCount + (message ? 1 : 0) + msgLines.length;
    return { msgLines, fits: total * lineHeightIn(s) <= boxH };
  };
  for (let s = capPt; s >= floorPt; s -= 0.5) {
    const m = measure(s);
    if (m.fits) return { size: s, msgLines: m.msgLines };
  }
  return { size: floorPt, msgLines: measure(floorPt).msgLines };
}

function drawGiftLabel(doc, x, y, w, h, p, img) {
  doc.addImage(img, 'PNG', x, y, w, h, 'giftbg', 'FAST');

  const bx = x + GIFT_BOX.x * w;
  const by = y + GIFT_BOX.y * h;
  const bw = GIFT_BOX.w * w;
  const bh = GIFT_BOX.h * h;

  doc.setFont(GIFT_FONT, 'normal');

  const recipient = (p.recipient_name || '').trim();
  const from = (p.customer_name || '').trim();
  const message = (p.gift_message || '').trim() || DEFAULT_GIFT_MESSAGE;

  // Decide whether "To … From …" goes on one line or two, and the cap size.
  let fixedLines;
  let capPt;
  if (!recipient) {
    fixedLines = [`From: ${from}`];
    capPt =
      widestSizeForWidth(doc, fixedLines, bw, GIFT_MAX_PT, GIFT_MIN_PT) ||
      GIFT_MIN_PT;
  } else {
    const oneLine = `To: ${recipient}     From: ${from}`;
    const oneSize = widestSizeForWidth(
      doc,
      [oneLine],
      bw,
      GIFT_MAX_PT,
      GIFT_MIN_ONELINE_PT
    );
    if (oneSize != null) {
      fixedLines = [oneLine];
      capPt = oneSize;
    } else {
      fixedLines = [`To: ${recipient}`, `From: ${from}`];
      capPt =
        widestSizeForWidth(doc, fixedLines, bw, GIFT_MAX_PT, GIFT_MIN_PT) ||
        GIFT_MIN_PT;
    }
  }

  const { size, msgLines } = wholeBlockSize(
    doc,
    fixedLines,
    message,
    bw,
    bh,
    capPt,
    GIFT_MIN_PT
  );

  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);

  // Wrap fixed lines too, as a final guard against clipping (no-op normally).
  const renderedFixed = fixedLines.flatMap((l) => doc.splitTextToSize(l, bw));
  const allLines = [...renderedFixed, '', ...msgLines];
  const lh = lineHeightIn(size);
  const blockH = allLines.length * lh;
  let ty = by + Math.max(0, (bh - blockH) / 2) + lh * 0.85;
  for (const line of allLines) {
    if (line !== '') doc.text(line, x + w / 2, ty, { align: 'center' });
    ty += lh;
  }
}

// Build the label PDF. `kind` is 'gift' | 'shipping'. `startSlot` is 0-based,
// row-major; products flow from there and onto new sheets as needed.
export async function generateLabelPdf({ kind, products, template: t, startSlot = 0 }) {
  const doc = new jsPDF({ unit: 'in', format: [t.page_w, t.page_h] });
  const per = slotsPerSheet(t);

  let img = null;
  if (kind === 'gift') {
    img = await loadGiftImage();
    await registerGiftFont(doc);
  }

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
