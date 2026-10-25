import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  money,
  filterItems,
  distinctSorted,
  groupProductRows,
} from '../util';
import FilterPanel from './FilterPanel';
import { useSeason, seasonSlug } from '../season';
import BarGraph from './BarGraph';
import {
  computeExtraStats,
  groupByPrice,
  groupByMethod,
  groupByDay,
  sellThrough,
  totalSellThrough,
  topCustomers,
  pctText,
  exportReportCsv,
  exportReportPdf,
} from '../financialsReport';

const PRICE_METRIC = [{ key: 'lineItems', label: 'Products sold' }];
const METHOD_METRIC = [{ key: 'revenue', label: 'Revenue', money: true }];
const DAY_METRIC = [{ key: 'orders', label: 'Orders' }];

// Generic read-only table: columns [{ label }], rows of rendered cells.
function SimpleTable({ columns, rows, empty = 'No data for the current filters.' }) {
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="subtle">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// One bar per tray: sold out of starting quantity, with a combined total first.
function SellThrough({ rows, total, filtered }) {
  return (
    <div className="bargraph">
      <div className="bg-head">
        <h3>Sell-through (limiting stock)</h3>
      </div>
      {rows.length === 0 ? (
        <p className="subtle">
          No limiting-stock materials yet — flag trays as “Limiting stock” on the
          Materials tab.
        </p>
      ) : (
        <>
          <div className="st-total">
            <div className="st-top">
              <strong>Total Sell-through</strong>
              <span>
                {total.start
                  ? `${total.sold} / ${total.start} sold · ${pctText(total.pct)}`
                  : 'Set starting quantities on the Materials tab'}
              </span>
            </div>
            <span className="bg-track">
              <span
                className="bg-fill"
                style={{
                  width: Math.min(100, Math.max(0, (total.pct || 0) * 100)) + '%',
                }}
              />
            </span>
            <div className="st-meta subtle">
              <span>
                {total.remaining} remaining across {total.trays} tray type
                {total.trays === 1 ? '' : 's'}
              </span>
              <span>
                {total.productsSold} product{total.productsSold === 1 ? '' : 's'} sold
                on trays
              </span>
            </div>
          </div>
          <div className="st-rows">
            {rows.map((r) => (
              <div className="st-row" key={r.id}>
                <div className="st-top">
                  <strong>{r.label}</strong>
                  <span className="subtle">
                    {r.start == null
                      ? 'Set a starting quantity on the Materials tab'
                      : `${r.sold} / ${r.start} sold · ${pctText(r.pct)}`}
                  </span>
                </div>
                <span className="bg-track">
                  <span
                    className="bg-fill"
                    style={{
                      width: Math.min(100, Math.max(0, (r.pct || 0) * 100)) + '%',
                    }}
                  />
                </span>
                <div className="st-meta subtle">
                  <span className={r.remaining <= 0 ? 'neg' : ''}>
                    {r.remaining <= 0 ? 'Sold out' : `${r.remaining} remaining`}
                  </span>
                  <span>
                    {r.productsSold} product{r.productsSold === 1 ? '' : 's'} sold on
                    this tray
                  </span>
                </div>
              </div>
            ))}
          </div>
          {filtered && (
            <p className="hint">
              Sold / remaining are overall tray stock; product counts follow the
              filters.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, value, tone }) {
  return (
    <div className={'card' + (tone ? ' ' + tone : '')}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

function computeSummary(list) {
  let paidRev = 0;
  let notPaidRev = 0;
  let paidProfit = 0;
  let notPaidProfit = 0;
  let deliveryIncome = 0;
  const orderIds = new Set();
  for (const p of list) {
    orderIds.add(p.order_id);
    deliveryIncome += Number(p.delivery_charge) || 0;
    const rev = Number(p.price) || 0;
    const prof = Number(p.profit) || 0;
    if (p.payment_status === 'Paid') {
      paidRev += rev;
      paidProfit += prof;
    } else {
      notPaidRev += rev;
      notPaidProfit += prof;
    }
  }
  return {
    totalOrders: orderIds.size,
    totalProducts: list.length,
    deliveryIncome,
    revenue: { paid: paidRev, notPaid: notPaidRev, total: paidRev + notPaidRev },
    profit: {
      paid: paidProfit,
      notPaid: notPaidProfit,
      total: paidProfit + notPaidProfit,
    },
  };
}

function BreakdownTable({ title, rows }) {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  return (
    <>
      <h3>{title}</h3>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>{title.replace('By ', '')}</th>
              <th>Orders</th>
              <th>Items</th>
              <th>Revenue</th>
              <th>Cost</th>
              <th>Profit</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{r.count}</td>
                <td>{r.lineItems}</td>
                <td>{money(r.revenue)}</td>
                <td>{money(r.cost)}</td>
                <td>{money(r.profit)}</td>
                <td>{money(r.delivery)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="subtle">
                  No data for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Financials() {
  const { current } = useSeason();
  const [products, setProducts] = useState(null);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState({});
  const [prodMetric, setProdMetric] = useState('count');
  const [locMetric, setLocMetric] = useState('count');
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([
      api.get('/products'),
      api.get('/delivery-locations'),
      api.get('/materials'),
    ])
      .then(([p, l, m]) => {
        setProducts(p);
        setLocations(l);
        setMaterials(m);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const filterCategories = useMemo(() => {
    const list = products || [];
    return [
      {
        key: 'name',
        label: 'Product Name',
        options: distinctSorted(list.map((p) => p.name)).map((n) => ({
          value: n,
          label: n,
        })),
        match: (p, v) => v.includes(p.name),
      },
      {
        key: 'fulfillment',
        label: 'Pickup / Delivery',
        options: [
          { value: 'Delivery', label: 'Delivery' },
          { value: 'Pickup', label: 'Pickup' },
        ],
        match: (p, v) => v.includes(p.fulfillment),
      },
      {
        key: 'location',
        label: 'Location',
        options: distinctSorted([
          ...locations.map((l) => l.name),
          ...list.map((p) => p.delivery_location),
        ]).map((n) => ({ value: n, label: n })),
        match: (p, v) => v.includes(p.delivery_location || ''),
      },
    ];
  }, [products, locations]);

  const filtered = useMemo(
    () => filterItems(products || [], filterCategories, filters),
    [products, filterCategories, filters]
  );

  const summary = useMemo(() => computeSummary(filtered), [filtered]);
  const byProduct = useMemo(
    () => groupProductRows(filtered, (p) => p.name || '—'),
    [filtered]
  );
  const byLocation = useMemo(
    () =>
      groupProductRows(filtered, (p) =>
        p.fulfillment === 'Pickup'
          ? 'Pickup'
          : p.delivery_location || 'No location'
      ),
    [filtered]
  );

  const extra = useMemo(() => computeExtraStats(summary), [summary]);
  const byPrice = useMemo(() => groupByPrice(filtered), [filtered]);
  const byMethod = useMemo(() => groupByMethod(filtered), [filtered]);
  const byDay = useMemo(() => groupByDay(filtered), [filtered]);
  const trays = useMemo(() => materials.filter((m) => m.is_limiting), [materials]);
  const sell = useMemo(() => sellThrough(filtered, trays), [filtered, trays]);
  const sellTotal = useMemo(() => totalSellThrough(filtered, trays), [filtered, trays]);
  const customers = useMemo(() => topCustomers(filtered), [filtered]);

  const activeFilters = filterCategories
    .map((c) => ({
      label: c.label,
      values: (filters[c.key] || []).map(
        (v) => (c.options.find((o) => o.value === v) || {}).label || v
      ),
    }))
    .filter((f) => f.values.length);

  // Everything the exports need, built from exactly what's on screen.
  const buildReport = () => {
    const metricKey = (m) => (m === 'revenue' || m === 'profit' ? m : 'count');
    const metricName = { count: 'Count', revenue: 'Revenue', profit: 'Profit' };
    const breakdownCols = [
      { label: '' },
      { label: 'Orders' },
      { label: 'Items' },
      { label: 'Revenue', money: true },
      { label: 'Cost', money: true },
      { label: 'Profit', money: true },
      { label: 'Delivery', money: true },
    ];
    const breakdownRows = (rows) =>
      [...rows]
        .sort((a, b) => b.revenue - a.revenue)
        .map((r) => [r.label, r.count, r.lineItems, r.revenue, r.cost, r.profit, r.delivery]);
    const barRows = (rows, key) =>
      [...rows]
        .sort((a, b) => (b[key] || 0) - (a[key] || 0))
        .map((r) => ({ label: r.label, value: r[key] }));
    const card = (label, value, csv) => ({ label, value, csv });

    return {
      title: `Purim Platform — Financials · ${current.name}`,
      season: current.name,
      fileSlug: seasonSlug(current),
      generated: new Date(),
      filters: activeFilters,
      cardGroups: [
        {
          title: 'Overview',
          cards: [
            card('Total orders', String(summary.totalOrders), summary.totalOrders),
            card('Total products sold', String(summary.totalProducts), summary.totalProducts),
            card('Total delivery income', money(summary.deliveryIncome), summary.deliveryIncome.toFixed(2)),
            card('Average order value', money(extra.avgOrderValue), extra.avgOrderValue.toFixed(2)),
            card(
              'Profit margin',
              pctText(extra.profitMargin),
              extra.profitMargin == null ? '' : (extra.profitMargin * 100).toFixed(1) + '%'
            ),
            card('Avg products per order', extra.avgProducts.toFixed(2), extra.avgProducts.toFixed(2)),
          ],
        },
        {
          title: 'Revenue',
          cards: [
            card('Paid revenue', money(summary.revenue.paid), summary.revenue.paid.toFixed(2)),
            card('Not paid revenue', money(summary.revenue.notPaid), summary.revenue.notPaid.toFixed(2)),
            card('Total revenue', money(summary.revenue.total), summary.revenue.total.toFixed(2)),
          ],
        },
        {
          title: 'Profit (price - cost)',
          cards: [
            card('Paid profit', money(summary.profit.paid), summary.profit.paid.toFixed(2)),
            card('Not paid profit', money(summary.profit.notPaid), summary.profit.notPaid.toFixed(2)),
            card('Total profit', money(summary.profit.total), summary.profit.total.toFixed(2)),
          ],
        },
      ],
      tables: [
        {
          title: 'By Product',
          columns: [{ label: 'Product' }, ...breakdownCols.slice(1)],
          rows: breakdownRows(byProduct),
        },
        {
          title: 'By Location',
          columns: [{ label: 'Location' }, ...breakdownCols.slice(1)],
          rows: breakdownRows(byLocation),
        },
        {
          title: 'By Price Range ($10 steps)',
          columns: [
            { label: 'Price range' },
            { label: 'Products sold' },
            { label: 'Orders' },
            { label: 'Revenue', money: true },
            { label: 'Profit', money: true },
          ],
          rows: byPrice.map((r) => [r.label, r.lineItems, r.count, r.revenue, r.profit]),
        },
        {
          title: 'By Payment Method',
          columns: [
            { label: 'Payment method' },
            { label: 'Orders' },
            { label: 'Products' },
            { label: 'Revenue', money: true },
            { label: 'Profit', money: true },
          ],
          rows: byMethod.map((r) => [r.label, r.count, r.lineItems, r.revenue, r.profit]),
        },
        {
          title: 'Sell-through (limiting stock)',
          columns: [
            { label: 'Tray' },
            { label: 'Starting' },
            { label: 'Sold' },
            { label: 'Remaining' },
            { label: '% sold', pct: true },
            { label: 'Products sold' },
          ],
          rows: [
            ...(trays.length
              ? [[
                  'TOTAL (all trays)',
                  sellTotal.start,
                  sellTotal.sold,
                  sellTotal.remaining,
                  sellTotal.pct,
                  sellTotal.productsSold,
                ]]
              : []),
            ...sell.map((r) => [r.label, r.start, r.sold, r.remaining, r.pct, r.productsSold]),
          ],
        },
        {
          title: 'Orders by Day',
          columns: [
            { label: 'Date' },
            { label: 'Orders' },
            { label: 'Products' },
            { label: 'Revenue', money: true },
          ],
          rows: byDay.map((r) => [r.key, r.orders, r.products, r.revenue]),
        },
        {
          title: 'Top Customers (2+ orders)',
          columns: [
            { label: 'Customer' },
            { label: 'Phone', text: true },
            { label: 'Orders' },
            { label: 'Total spent', money: true },
          ],
          rows: customers.map((c) => [c.name, c.phone, c.orders, c.spent]),
        },
      ],
      charts: [
        {
          title: `Orders by Product Name (${metricName[metricKey(prodMetric)]})`,
          money: metricKey(prodMetric) !== 'count',
          rows: barRows(byProduct, metricKey(prodMetric)),
        },
        {
          title: `Orders by Location (${metricName[metricKey(locMetric)]})`,
          money: metricKey(locMetric) !== 'count',
          rows: barRows(byLocation, metricKey(locMetric)),
        },
        {
          title: 'Orders by Price Point ($10 ranges, products sold)',
          rows: byPrice.map((r) => ({ label: r.label, value: r.lineItems })),
        },
        {
          title: 'Revenue by Payment Method',
          money: true,
          rows: byMethod.map((r) => ({ label: r.label, value: r.revenue })),
        },
        {
          title: 'Sell-through (% of starting quantity sold)',
          rows: [
            ...(sellTotal.start
              ? [{
                  label: 'Total (all trays)',
                  value: Math.max(0, sellTotal.pct || 0),
                  display: `${sellTotal.sold}/${sellTotal.start} · ${pctText(sellTotal.pct)}`,
                }]
              : []),
            ...sell
            .filter((r) => r.start)
            .map((r) => ({
              label: r.label,
              value: Math.max(0, r.pct || 0),
              display: `${r.sold}/${r.start} · ${pctText(r.pct)}`,
            })),
          ],
        },
        {
          title: 'Orders by Day',
          rows: byDay.map((r) => ({ label: r.label, value: r.orders })),
        },
      ],
    };
  };

  const [exporting, setExporting] = useState(false);
  const runExport = (fn) => {
    setExporting(true);
    try {
      fn(buildReport());
    } catch (e) {
      window.alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <div className="panel">
        <h1>Financials</h1>
        <div className="error">{error}</div>
      </div>
    );
  }
  if (products === null) {
    return (
      <div className="panel">
        <h1>Financials</h1>
        <p className="subtle">Loading…</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Financials</h1>
        <div className="ph-actions">
          <button onClick={load}>Refresh</button>
          <button disabled={exporting} onClick={() => runExport(exportReportCsv)}>
            Export CSV
          </button>
          <button
            className="primary"
            disabled={exporting}
            onClick={() => runExport(exportReportPdf)}
          >
            Export PDF
          </button>
        </div>
      </div>
      <p className="subtle">
        Live totals for every product in <strong>{current.name}</strong>. Filters
        below apply to everything on this tab.
      </p>

      <FilterPanel
        categories={filterCategories}
        state={filters}
        onChange={setFilters}
      />

      <div className="cards">
        <Card label="Total orders" value={summary.totalOrders} />
        <Card label="Total products sold" value={summary.totalProducts} />
        <Card
          label="Total delivery income"
          value={money(summary.deliveryIncome)}
        />
        <Card label="Average order value" value={money(extra.avgOrderValue)} />
        <Card label="Profit margin" value={pctText(extra.profitMargin)} />
        <Card label="Avg products per order" value={extra.avgProducts.toFixed(2)} />
      </div>

      <h3>Revenue</h3>
      <div className="cards">
        <Card label="Paid revenue" value={money(summary.revenue.paid)} tone="ok" />
        <Card
          label="Not paid revenue"
          value={money(summary.revenue.notPaid)}
          tone="warn"
        />
        <Card label="Total revenue" value={money(summary.revenue.total)} />
      </div>

      <h3>Profit (price − cost)</h3>
      <div className="cards">
        <Card label="Paid profit" value={money(summary.profit.paid)} tone="ok" />
        <Card
          label="Not paid profit"
          value={money(summary.profit.notPaid)}
          tone="warn"
        />
        <Card label="Total profit" value={money(summary.profit.total)} />
      </div>

      <BreakdownTable title="By Product" rows={byProduct} />
      <BreakdownTable title="By Location" rows={byLocation} />

      <BarGraph
        title="Orders by Product Name"
        rows={byProduct}
        metric={prodMetric}
        onMetric={setProdMetric}
      />
      <BarGraph
        title="Orders by Location"
        rows={byLocation}
        metric={locMetric}
        onMetric={setLocMetric}
      />

      <BarGraph
        title="Orders by Price Point"
        rows={byPrice}
        metrics={PRICE_METRIC}
        keepOrder
      />

      <SellThrough rows={sell} total={sellTotal} filtered={activeFilters.length > 0} />

      <BarGraph
        title="Revenue by Payment Method"
        rows={byMethod}
        metrics={METHOD_METRIC}
      />

      <BarGraph title="Orders by Day" rows={byDay} metrics={DAY_METRIC} keepOrder />

      <h3>Top Customers</h3>
      <SimpleTable
        columns={['Customer', 'Phone', 'Orders', 'Total spent']}
        rows={customers.map((c) => [c.name, c.phone || '—', c.orders, money(c.spent)])}
        empty="No customers with 2 or more orders for the current filters."
      />
      <p className="hint">
        Matched by name and phone number. Total spent includes delivery charges.
      </p>
    </div>
  );
}
