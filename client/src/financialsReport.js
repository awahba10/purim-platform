import { jsPDF } from 'jspdf';
import { money, toCSV, downloadCSV, groupProductRows } from './util';

// ---------------------------------------------------------------------------
// Calculations shared by the Financials tab and its CSV / PDF exports. Every
// function takes the already-filtered product rows.
// ---------------------------------------------------------------------------

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
export const dayLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const pctText = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

// Average order value, profit margin, average products per order.
export function computeExtraStats(summary) {
  const orders = summary.totalOrders;
  return {
    avgOrderValue: orders ? summary.revenue.total / orders : 0,
    profitMargin: summary.revenue.total ? summary.profit.total / summary.revenue.total : null,
    avgProducts: orders ? summary.totalProducts / orders : 0,
  };
}

// $10 price ranges, cheapest first. A boundary price goes in the higher range
// ($20 -> $20–30). Only ranges with at least one product appear.
// `lineItems` = products sold in the range.
export function groupByPrice(list) {
  const lo = (p) => Math.floor((Number(p.price) || 0) / 10) * 10;
  return groupProductRows(list, (p) => String(lo(p)))
    .map((g) => {
      const low = Number(g.label);
      return { ...g, price: low, label: `$${low}–${low + 10}` };
    })
    .sort((a, b) => a.price - b.price);
}

// Revenue per payment method; orders with none fall under "Not set".
export function groupByMethod(list) {
  return groupProductRows(list, (p) => (p.payment_method || '').trim() || 'Not set').sort(
    (a, b) => b.revenue - a.revenue
  );
}

// Distinct orders created each day, oldest first.
export function groupByDay(list) {
  const map = new Map();
  for (const p of list) {
    const k = dayKey(p.order_created_at || p.created_at);
    let g = map.get(k);
    if (!g) {
      g = { key: k, orders: new Set(), products: 0, revenue: 0 };
      map.set(k, g);
    }
    g.orders.add(p.order_id);
    g.products += 1;
    g.revenue += Number(p.price) || 0;
  }
  return [...map.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((g) => ({
      key: g.key,
      label: dayLabel(g.key),
      orders: g.orders.size,
      products: g.products,
      revenue: g.revenue,
    }));
}

// Per limiting-stock tray: sold = starting − current (overall stock, not
// filtered); productsSold = filtered products that use the tray.
export function sellThrough(list, trays) {
  return trays
    .map((t) => {
      const start = t.starting_quantity;
      const remaining = Number(t.quantity) || 0;
      const sold = start == null ? null : start - remaining;
      return {
        id: t.id,
        label: t.name,
        start,
        remaining,
        sold,
        pct: start ? sold / start : null,
        productsSold: list.filter((p) =>
          (p.materials || []).some((m) => m.material_id === t.id)
        ).length,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

// All trays with a starting quantity combined. productsSold = filtered
// products using any tray (each product counted once).
export function totalSellThrough(list, trays) {
  const counted = trays.filter((t) => t.starting_quantity != null);
  const start = counted.reduce((n, t) => n + Number(t.starting_quantity), 0);
  const remaining = counted.reduce((n, t) => n + (Number(t.quantity) || 0), 0);
  const sold = start - remaining;
  const ids = new Set(trays.map((t) => t.id));
  return {
    trays: counted.length,
    start,
    remaining,
    sold,
    pct: start ? sold / start : null,
    productsSold: list.filter((p) =>
      (p.materials || []).some((m) => ids.has(m.material_id))
    ).length,
  };
}

// Customers with 2+ orders, matched on name + phone. Total spent includes
// delivery charges.
export function topCustomers(list) {
  const orders = new Map();
  for (const p of list) {
    let o = orders.get(p.order_id);
    if (!o) {
      o = { name: p.customer_name || '', phone: p.phone || '', total: 0 };
      orders.set(p.order_id, o);
    }
    o.total += (Number(p.price) || 0) + (Number(p.delivery_charge) || 0);
  }
  const people = new Map();
  for (const o of orders.values()) {
    const k =
      o.name.trim().toLowerCase().replace(/\s+/g, ' ') + '|' + o.phone.replace(/\D/g, '');
    let c = people.get(k);
    if (!c) {
      c = { name: o.name.trim(), phone: o.phone, orders: 0, spent: 0 };
      people.set(k, c);
    }
    c.orders += 1;
    c.spent += o.total;
  }
  return [...people.values()]
    .filter((c) => c.orders >= 2)
    .sort((a, b) => b.orders - a.orders || b.spent - a.spent);
}

// ---------------------------------------------------------------------------
// Report model -> CSV / PDF.
//
// report = {
//   title, generated: Date,
//   filters: [{ label, values: string[] }],
//   cardGroups: [{ title, cards: [{ label, value }] }],
//   tables: [{ title, columns: [{ label, num?, money?, pct? }], rows: [[raw values]] }],
//   charts: [{ title, money?, rows: [{ label, value }] }],
// }
// Table cells hold raw values; CSV writes plain numbers, PDF formats them.
// ---------------------------------------------------------------------------

const cellText = (col, v, forCsv) => {
  if (v == null || v === '') return forCsv ? '' : '—';
  if (col.money) return forCsv ? Number(v).toFixed(2) : money(v);
  if (col.pct) return forCsv ? (Number(v) * 100).toFixed(1) : pctText(v);
  return String(v);
};

export function exportReportCsv(report) {
  const blocks = [];
  const esc = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  // Each section: a title line, then its own header row + data rows.
  const section = (title, columns, rows) =>
    blocks.push(esc(String(title)) + '\r\n' + toCSV(rows, columns));

  section(
    report.title,
    [{ label: 'Item', get: (r) => r[0] }, { label: 'Value', get: (r) => r[1] }],
    [
      ['Generated', report.generated.toLocaleString()],
      [
        'Active filters',
        report.filters.length
          ? report.filters.map((f) => `${f.label}: ${f.values.join(' / ')}`).join('; ')
          : 'None',
      ],
    ]
  );

  for (const g of report.cardGroups) {
    section(
      `Summary — ${g.title}`,
      [{ label: 'Metric', get: (r) => r.label }, { label: 'Value', get: (r) => r.csv }],
      g.cards
    );
  }

  for (const t of report.tables) {
    section(
      t.title,
      t.columns.map((c, i) => ({ label: c.label, get: (r) => cellText(c, r[i], true) })),
      t.rows
    );
  }

  downloadCSV(`purim-financials-${dayKey(report.generated)}.csv`, blocks.join('\r\n\r\n'));
}

// Standard PDF fonts only cover Latin-1 + a few typographic marks.
const KEEP = new Set(['—', '–', '…', '•', '‘', '’', '“', '”', '€']);
const clean = (s) =>
  String(s ?? '')
    .replace(/−/g, '-')
    .replace(/[^\u0000-ÿ]/g, (ch) => (KEEP.has(ch) ? ch : '?'));

export function exportReportPdf(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 40;
  const CW = PW - 2 * M;
  const BOTTOM = PH - M - 14; // leave room for the page footer
  const BRAND = [124, 58, 237];
  const SOFT = [243, 239, 254];
  const MUTED = [107, 114, 128];
  const INK = [31, 36, 48];
  const LINE = [229, 231, 235];
  let y = M;

  const ensure = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };
  const font = (size, style = 'normal', color = INK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  // Shorten text with an ellipsis until it fits `w`.
  const fit = (text, w) => {
    let t = clean(text);
    if (doc.getTextWidth(t) <= w) return t;
    while (t.length > 1 && doc.getTextWidth(t + '…') > w) t = t.slice(0, -1);
    return t + '…';
  };
  const heading = (text, after = 0) => {
    ensure(30 + after);
    y += 10;
    font(13, 'bold');
    doc.text(clean(text), M, y + 10);
    y += 20;
  };

  // Title + filters
  font(20, 'bold');
  doc.text(clean(report.title), M, y + 16);
  y += 26;
  font(9, 'normal', MUTED);
  doc.text(clean(`Generated ${report.generated.toLocaleString()}`), M, y + 8);
  y += 18;
  font(10, 'bold');
  doc.text('Active filters', M, y + 8);
  y += 14;
  font(9.5, 'normal');
  const filterLines = report.filters.length
    ? report.filters.flatMap((f) =>
        doc.splitTextToSize(clean(`${f.label}: ${f.values.join(', ')}`), CW)
      )
    : ['None — showing everything'];
  for (const line of filterLines) {
    ensure(13);
    doc.text(line, M, y + 8);
    y += 13;
  }
  y += 4;

  // Summary cards, three per row
  const GAP = 10;
  const CARD_W = (CW - 2 * GAP) / 3;
  const CARD_H = 46;
  for (const g of report.cardGroups) {
    heading(g.title, CARD_H);
    g.cards.forEach((c, i) => {
      const col = i % 3;
      if (col === 0 && i > 0) y += CARD_H + GAP;
      if (col === 0) ensure(CARD_H);
      const x = M + col * (CARD_W + GAP);
      doc.setDrawColor(...LINE);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, CARD_W, CARD_H, 6, 6, 'FD');
      font(8.5, 'normal', MUTED);
      doc.text(fit(c.label, CARD_W - 16), x + 8, y + 15);
      font(14, 'bold');
      doc.text(fit(c.value, CARD_W - 16), x + 8, y + 35);
    });
    y += CARD_H + GAP;
  }

  // Tables
  const ROW_H = 16;
  for (const t of report.tables) {
    heading(t.title, ROW_H * 2);
    const n = t.columns.length;
    const firstW = Math.min(CW * 0.34, CW / n + 70);
    const restW = (CW - firstW) / Math.max(1, n - 1);
    const widths = t.columns.map((_, i) => (i === 0 ? firstW : restW));
    const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const isLeft = (i) => i === 0 || t.columns[i].text;

    const drawRow = (cells, header) => {
      if (header) {
        doc.setFillColor(...SOFT);
        doc.rect(M, y, CW, ROW_H, 'F');
      } else {
        doc.setDrawColor(...LINE);
        doc.line(M, y + ROW_H, M + CW, y + ROW_H);
      }
      font(8.5, header ? 'bold' : 'normal', header ? BRAND : INK);
      cells.forEach((txt, i) => {
        const w = widths[i] - 8;
        const s = fit(txt, w);
        if (isLeft(i)) doc.text(s, xs[i] + 4, y + 11);
        else doc.text(s, xs[i] + widths[i] - 4, y + 11, { align: 'right' });
      });
      y += ROW_H;
    };

    const header = t.columns.map((c) => c.label);
    drawRow(header, true);
    if (!t.rows.length) {
      ensure(ROW_H);
      font(8.5, 'italic', MUTED);
      doc.text('No data for the current filters.', M + 4, y + 11);
      y += ROW_H;
    }
    for (const r of t.rows) {
      if (y + ROW_H > BOTTOM) {
        doc.addPage();
        y = M;
        drawRow(header, true);
      }
      drawRow(t.columns.map((c, i) => cellText(c, r[i], false)), false);
    }
  }

  // Charts (horizontal bars, drawn as vector shapes so they always render)
  const BAR_H = 15;
  for (const c of report.charts) {
    heading(c.title, BAR_H * 2);
    if (!c.rows.length) {
      font(9, 'italic', MUTED);
      doc.text('No data for the current filters.', M, y + 9);
      y += BAR_H;
      continue;
    }
    const LABEL_W = 150;
    const VAL_W = 80;
    const trackX = M + LABEL_W + 8;
    const trackW = CW - LABEL_W - VAL_W - 16;
    const max = Math.max(1, ...c.rows.map((r) => Math.abs(Number(r.value) || 0)));
    for (const r of c.rows) {
      ensure(BAR_H);
      const v = Number(r.value) || 0;
      font(8.5, 'normal');
      doc.text(fit(r.label, LABEL_W), M, y + 10);
      doc.setFillColor(...SOFT);
      doc.rect(trackX, y + 2, trackW, 10, 'F');
      if (v !== 0) {
        doc.setFillColor(...BRAND);
        doc.rect(trackX, y + 2, Math.max(1.5, (Math.abs(v) / max) * trackW), 10, 'F');
      }
      font(8.5, 'normal', MUTED);
      doc.text(
        fit(r.display != null ? r.display : c.money ? money(v) : String(v), VAL_W),
        M + CW,
        y + 10,
        { align: 'right' }
      );
      y += BAR_H;
    }
  }

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    font(8, 'normal', MUTED);
    doc.text(clean(report.title), M, PH - M + 10);
    doc.text(`Page ${i} of ${pages}`, PW - M, PH - M + 10, { align: 'right' });
  }

  doc.save(`purim-financials-${dayKey(report.generated)}.pdf`);
}
