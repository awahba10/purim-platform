import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../util';

function Card({ label, value, tone }) {
  return (
    <div className={'card' + (tone ? ' ' + tone : '')}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

export default function Financials() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    api.get('/financials').then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <div className="panel">
        <h1>Financials</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!data) {
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
        Live totals. One order can hold several products; revenue and profit are
        summed across every product.
      </p>

      <div className="cards">
        <Card label="Total orders" value={data.totalOrders} />
        <Card label="Total products sold" value={data.totalProductsSold} />
      </div>

      <h3>Revenue</h3>
      <div className="cards">
        <Card label="Paid revenue" value={money(data.revenue.paid)} tone="ok" />
        <Card
          label="Not paid revenue"
          value={money(data.revenue.notPaid)}
          tone="warn"
        />
        <Card label="Total revenue" value={money(data.revenue.total)} />
      </div>

      <h3>Profit (price − cost)</h3>
      <div className="cards">
        <Card label="Paid profit" value={money(data.profit.paid)} tone="ok" />
        <Card
          label="Not paid profit"
          value={money(data.profit.notPaid)}
          tone="warn"
        />
        <Card label="Total profit" value={money(data.profit.total)} />
      </div>
    </div>
  );
}
