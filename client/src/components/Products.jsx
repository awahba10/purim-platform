import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { money, productToDraft, draftToPayload } from '../util';
import ProductFields from './ProductFields';

const COLUMNS = [
  { key: 'ticket_number', label: 'Ticket' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'name', label: 'Product' },
  { key: 'cost', label: 'Cost' },
  { key: 'price', label: 'Price' },
  { key: 'profit', label: 'Profit' },
  { key: 'created_at', label: 'Created' },
];

const NUMERIC = new Set(['cost', 'price', 'profit']);

export default function Products() {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [editing, setEditing] = useState(null); // { product, draft }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.get('/products'), api.get('/materials')])
      .then(([p, m]) => {
        setProducts(p);
        setMaterials(m);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = products;
    if (needle) {
      list = list.filter((p) =>
        [p.name, p.ticket_number, p.customer_name].some((v) =>
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
  }, [products, query, sort]);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );

  const save = async () => {
    if (!editing.draft.name.trim()) return setError('The product needs a name.');
    setBusy(true);
    setError('');
    try {
      await api.patch(
        `/products/${editing.product.id}`,
        draftToPayload(editing.draft, materials)
      );
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (
      !window.confirm(
        `Delete "${p.name}" (ticket ${p.ticket_number})? Its materials go back to stock.`
      )
    )
      return;
    try {
      await api.del(`/products/${p.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="panel">
      <h1>Products</h1>
      <p className="subtle">
        Every product from every order — one row each. Editing here changes the same
        record the order shows.
      </p>
      <input
        className="search"
        placeholder="Search by product, ticket, or customer…"
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
              <th>Materials</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                onClick={() => setEditing({ product: p, draft: productToDraft(p) })}
              >
                <td>{p.ticket_number}</td>
                <td>{p.customer_name}</td>
                <td>{p.name}</td>
                <td>{money(p.cost)}</td>
                <td>{money(p.price)}</td>
                <td>{money(p.profit)}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="subtle">
                  {p.materials.length
                    ? p.materials
                        .map((m) => `${m.material_name} ×${m.quantity_used}`)
                        .join(', ')
                    : '—'}
                </td>
                <td className="right">
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(p);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="subtle">
                  No products yet — create an order.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit product · ticket {editing.product.ticket_number}</h2>
              <button
                className="icon-btn"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ProductFields
              value={editing.draft}
              catalog={materials}
              onChange={(next) => setEditing((cur) => ({ ...cur, draft: next }))}
            />
            <div className="modal-actions">
              <button className="primary" onClick={save} disabled={busy}>
                Save changes
              </button>
              <button onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
