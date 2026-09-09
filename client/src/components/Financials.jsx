import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  money,
  filterItems,
  distinctSorted,
  groupProductRows,
} from '../util';
import FilterPanel from './FilterPanel';
import BarGraph from './BarGraph';

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
  const [products, setProducts] = useState(null);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({});
  const [prodMetric, setProdMetric] = useState('count');
  const [locMetric, setLocMetric] = useState('count');
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([api.get('/products'), api.get('/delivery-locations')])
      .then(([p, l]) => {
        setProducts(p);
        setLocations(l);
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
        <button onClick={load}>Refresh</button>
      </div>
      <p className="subtle">
        Live totals from every product. Filters below apply to everything on this
        tab.
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
    </div>
  );
}
