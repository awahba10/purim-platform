import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { money } from '../util';
import OrderDetail from './OrderDetail';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'product_name', label: 'Product' },
  { key: 'price', label: 'Price' },
  { key: 'payment_status', label: 'Payment' },
  { key: 'progress_status', label: 'Progress' },
  { key: 'created_at', label: 'Created' },
];

function progressClass(status) {
  if (status === 'Delivered') return 'ok';
  if (status === 'Made') return 'info';
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
        [o.name, o.phone, o.instagram].some((v) =>
          (v || '').toLowerCase().includes(needle)
        )
      );
    }
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === 'price') {
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

  return (
    <div className="panel">
      <h1>All Orders</h1>
      <input
        className="search"
        placeholder="Search by name, phone, or Instagram…"
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
                <td>{o.name}</td>
                <td>{o.phone || '—'}</td>
                <td>{o.instagram || '—'}</td>
                <td>{o.product_name || '—'}</td>
                <td>{money(o.price)}</td>
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
                  <span className={'badge ' + progressClass(o.progress_status)}>
                    {o.progress_status}
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
          onSaved={load}
          onDeleted={() => {
            setSelectedId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
