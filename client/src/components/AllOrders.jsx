import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { money, toCSV, downloadCSV } from '../util';
import OrderDetail from './OrderDetail';

const CSV_COLUMNS = [
  { key: 'ticket_number', label: 'Ticket' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'phone', label: 'Phone' },
  { key: 'contact_method', label: 'Contact' },
  { key: 'product_count', label: 'Products' },
  { label: 'Total cost', get: (o) => o.total_cost.toFixed(2) },
  { label: 'Total product charge', get: (o) => o.total_price.toFixed(2) },
  { label: 'Total profit', get: (o) => o.total_profit.toFixed(2) },
  { key: 'payment_status', label: 'Payment' },
  { key: 'progress_status', label: 'Progress' },
  { label: 'Progress source', get: (o) => (o.progress_is_auto ? 'auto' : 'manual') },
  { label: 'Created', get: (o) => new Date(o.created_at).toISOString() },
];

const COLUMNS = [
  { key: 'ticket_number', label: 'Ticket' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'phone', label: 'Phone' },
  { key: 'contact_method', label: 'Contact' },
  { key: 'product_count', label: 'Products' },
  { key: 'total_price', label: 'Charge' },
  { key: 'payment_status', label: 'Payment' },
  { key: 'progress_status', label: 'Progress' },
  { key: 'created_at', label: 'Created' },
];

const NUMERIC = new Set(['product_count', 'total_price']);

function progressClass(status) {
  if (status === 'Delivered' || status === 'All Made') return 'ok';
  if (status === 'Some Made') return 'info';
  return 'warn';
}

export default function AllOrders() {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    api.get('/orders').then(setOrders).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = orders;
    if (needle) {
      list = list.filter((o) =>
        [o.customer_name, o.phone, o.contact_method, o.ticket_number].some((v) =>
          (v || '').toLowerCase().includes(needle)
        )
      );
    }
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (NUMERIC.has(key)) {
        av = Number(av);
        bv = Number(bv);
      } else if (key === 'created_at') {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      } else {
        av = (av == null ? '' : String(av)).toLowerCase();
        bv = (bv == null ? '' : String(bv)).toLowerCase();
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, query, sort]);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );

  const exportCsv = () => {
    downloadCSV(
      `purim-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(orders, CSV_COLUMNS)
    );
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>All Orders</h1>
        <button onClick={exportCsv} disabled={orders.length === 0}>
          Export CSV
        </button>
      </div>
      <input
        className="search"
        placeholder="Search by customer, phone, contact, or ticket…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)}>
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} onClick={() => setSelectedId(o.id)}>
                <td>{o.ticket_number}</td>
                <td>{o.customer_name}</td>
                <td>{o.phone || '—'}</td>
                <td>{o.contact_method || '—'}</td>
                <td>{o.product_count}</td>
                <td>{money(o.total_price)}</td>
                <td>
                  <span
                    className={
                      'badge ' + (o.payment_status === 'Paid' ? 'ok' : 'warn')
                    }
                  >
                    {o.payment_status}
                  </span>
                </td>
                <td>
                  <span
                    className={'badge ' + progressClass(o.progress_status)}
                    title={
                      o.progress_is_auto
                        ? 'Auto from products'
                        : 'Manually set'
                    }
                  >
                    {o.progress_status}
                    {!o.progress_is_auto && ' •'}
                  </span>
                </td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="subtle">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <OrderDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
