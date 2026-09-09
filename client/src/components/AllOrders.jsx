import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import {
  money,
  toCSV,
  downloadCSV,
  filterItems,
  distinctSorted,
  classifyContact,
} from '../util';
import OrderDetail from './OrderDetail';
import FilterPanel from './FilterPanel';

const PRODUCTION_MAP = {
  'Not Made': 'None Made',
  'Some Made': 'Some Made',
  Made: 'All Made',
};
const DELIVERY_MAP = {
  'Not Delivered': 'None Delivered',
  'Some Delivered': 'Some Delivered',
  Delivered: 'All Delivered',
};

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
  { key: 'production_status', label: 'Production' },
  { label: 'Production source', get: (o) => (o.production_is_auto ? 'auto' : 'manual') },
  { key: 'delivery_status', label: 'Delivery' },
  { label: 'Delivery source', get: (o) => (o.delivery_is_auto ? 'auto' : 'manual') },
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
  { key: 'production_status', label: 'Production' },
  { key: 'delivery_status', label: 'Delivery' },
  { key: 'created_at', label: 'Created' },
];

const NUMERIC = new Set(['product_count', 'total_price']);

function statusClass(status) {
  if (status === 'All Made' || status === 'All Delivered') return 'ok';
  if (status === 'Some Made' || status === 'Some Delivered') return 'info';
  return 'warn';
}
function payClass(status) {
  if (status === 'Paid') return 'ok';
  if (status === 'Partially Paid') return 'mid';
  return 'warn';
}

export default function AllOrders() {
  const navigate = useNavigate();
  const { id } = useParams();
  const selectedId = /^\d+$/.test(id || '') ? Number(id) : null;
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [error, setError] = useState('');

  const load = () =>
    api.get('/orders').then(setOrders).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const filterCategories = useMemo(
    () => [
      {
        key: 'contact',
        label: 'Contact Method',
        options: distinctSorted(
          orders.map((o) => classifyContact(o.contact_method))
        ).map((c) => ({ value: c, label: c })),
        match: (o, v) => v.includes(classifyContact(o.contact_method)),
      },
      {
        key: 'payment',
        label: 'Payment Status',
        options: [
          { value: 'Paid', label: 'Paid' },
          { value: 'Partially Paid', label: 'Partially Paid' },
          { value: 'Not Paid', label: 'Not Paid' },
        ],
        match: (o, v) => v.includes(o.payment_status),
      },
      {
        key: 'production',
        label: 'Production Status',
        options: [
          { value: 'Not Made', label: 'Not Made' },
          { value: 'Some Made', label: 'Some Made' },
          { value: 'Made', label: 'Made' },
        ],
        match: (o, v) =>
          v.some((x) => PRODUCTION_MAP[x] === o.production_status),
      },
      {
        key: 'delivery',
        label: 'Delivery Status',
        options: [
          { value: 'Not Delivered', label: 'Not Delivered' },
          { value: 'Some Delivered', label: 'Some Delivered' },
          { value: 'Delivered', label: 'Delivered' },
        ],
        match: (o, v) =>
          v.some((x) => DELIVERY_MAP[x] === o.delivery_status),
      },
    ],
    [orders]
  );

  const rows = useMemo(() => {
    let list = filterItems(orders, filterCategories, filters);
    const needle = query.trim().toLowerCase();
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
  }, [orders, filterCategories, filters, query, sort]);

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
      <FilterPanel
        categories={filterCategories}
        state={filters}
        onChange={setFilters}
      />
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
              <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                <td>{o.ticket_number}</td>
                <td>{o.customer_name}</td>
                <td>{o.phone || '—'}</td>
                <td>{o.contact_method || '—'}</td>
                <td>{o.product_count}</td>
                <td>{money(o.total_price)}</td>
                <td>
                  <span className={'badge ' + payClass(o.payment_status)}>
                    {o.payment_status}
                  </span>
                </td>
                <td>
                  <span
                    className={'badge ' + statusClass(o.production_status)}
                    title={o.production_is_auto ? 'Auto from products' : 'Manually set'}
                  >
                    {o.production_status}
                    {!o.production_is_auto && ' •'}
                  </span>
                </td>
                <td>
                  <span
                    className={'badge ' + statusClass(o.delivery_status)}
                    title={o.delivery_is_auto ? 'Auto from products' : 'Manually set'}
                  >
                    {o.delivery_status}
                    {!o.delivery_is_auto && ' •'}
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
          onClose={() => navigate('/orders')}
          onChanged={load}
        />
      )}
    </div>
  );
}
