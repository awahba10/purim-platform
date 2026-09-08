import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  money,
  productToDraft,
  draftToPayload,
  toCSV,
  downloadCSV,
  validateProductDraft,
} from '../util';
import ProductFields from './ProductFields';
import LabelExport from './LabelExport';
import LabelSettings from './LabelSettings';

const COLUMNS = [
  { key: 'ticket_number', label: 'Ticket' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'name', label: 'Product' },
  { key: 'is_made', label: 'Made' },
  { key: 'fulfillment', label: 'Type' },
  { key: 'delivery_location', label: 'Location' },
  { key: 'address', label: 'Address' },
  { key: 'delivery_charge', label: 'Delivery $' },
  { key: 'cost', label: 'Cost' },
  { key: 'price', label: 'Price' },
  { key: 'profit', label: 'Profit' },
  { key: 'created_at', label: 'Created' },
];

const NUMERIC = new Set(['cost', 'price', 'profit', 'is_made', 'delivery_charge']);

const CSV_COLUMNS = [
  { key: 'ticket_number', label: 'Ticket' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'name', label: 'Product' },
  { label: 'Made', get: (p) => (p.is_made ? 'Made' : 'Not made') },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'delivery_location', label: 'Delivery location' },
  { key: 'address', label: 'Address' },
  { key: 'delivery_instructions', label: 'Delivery instructions' },
  { label: 'Delivery charge', get: (p) => Number(p.delivery_charge || 0).toFixed(2) },
  { key: 'recipient_name', label: 'Recipient' },
  { label: 'Cost', get: (p) => p.cost.toFixed(2) },
  { label: 'Price', get: (p) => p.price.toFixed(2) },
  { label: 'Profit', get: (p) => p.profit.toFixed(2) },
  {
    label: 'Materials',
    get: (p) => p.materials.map((m) => `${m.material_name} x${m.quantity_used}`).join('; '),
  },
  { label: 'Notes', get: (p) => p.notes || '' },
  { label: 'Gift message', get: (p) => p.gift_message || '' },
  { label: 'Gift label', get: (p) => (p.gift_label_printed ? 'printed' : '') },
  { label: 'Shipping label', get: (p) => (p.shipping_label_printed ? 'printed' : '') },
  { label: 'Created', get: (p) => new Date(p.created_at).toISOString() },
];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [labelExport, setLabelExport] = useState(null); // { kind }
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([
      api.get('/products'),
      api.get('/materials'),
      api.get('/delivery-locations'),
      api.get('/label-templates'),
    ])
      .then(([p, m, d, t]) => {
        setProducts(p);
        setMaterials(m);
        setDeliveryLocations(d);
        setTemplates(t);
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
        [p.name, p.ticket_number, p.customer_name, p.delivery_location, p.address].some(
          (v) => (v || '').toLowerCase().includes(needle)
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

  const templateFor = (kind) => templates.find((t) => t.key === kind);

  const allShownSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allShownSelected) rows.forEach((p) => next.delete(p.id));
      else rows.forEach((p) => next.add(p.id));
      return next;
    });
  const toggleOne = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedProducts = useMemo(
    () =>
      products
        .filter((p) => selected.has(p.id))
        .sort((a, b) => a.id - b.id),
    [products, selected]
  );

  const startExport = (kind) => {
    setError('');
    if (!selectedProducts.length) {
      setError('Tick the products you want labels for first.');
      return;
    }
    if (!templateFor(kind)) {
      setError('Label template not loaded yet — try again in a moment.');
      return;
    }
    setLabelExport({ kind });
  };

  const markPrinted = async (ids, kind) => {
    const field = kind === 'gift' ? 'gift_label_printed' : 'shipping_label_printed';
    for (const id of ids) {
      await api.patch(`/products/${id}`, { [field]: true });
    }
    setSelected(new Set());
    await load();
  };

  const toggleFlag = async (p, field) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/products/${p.id}`, { [field]: !p[field] });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () =>
    downloadCSV(
      `purim-products-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(products, CSV_COLUMNS)
    );

  const save = async () => {
    const d = editing.draft;
    const problem = validateProductDraft(d);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      await api.patch(`/products/${editing.product.id}`, draftToPayload(d, materials));
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

  const toggleMade = async (p) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/products/${p.id}`, { is_made: !p.is_made });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Products</h1>
        <div className="ph-actions">
          <button
            className="icon-btn gear"
            title="Label settings"
            aria-label="Label settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙
          </button>
          <button onClick={() => startExport('gift')}>Export Gift Labels</button>
          <button onClick={() => startExport('shipping')}>
            Export Shipping Labels
          </button>
          <button onClick={exportCsv} disabled={products.length === 0}>
            Export CSV
          </button>
        </div>
      </div>
      <p className="subtle">
        Every product from every order — one row each. Tick rows (narrow the list
        with search first) then use the label buttons above. Editing a row changes
        the same record the order shows.
      </p>
      <div className="row-between">
        <input
          className="search"
          placeholder="Search by product, ticket, customer, location, or address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {selected.size > 0 && (
          <span className="subtle">{selected.size} selected</span>
        )}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="chk-col">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={toggleAll}
                  aria-label="Select all shown"
                />
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)}>
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th>Labels</th>
              <th>Materials</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={selected.has(p.id) ? 'row-selected' : ''}
                onClick={() => setEditing({ product: p, draft: productToDraft(p) })}
              >
                <td className="chk-col" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    aria-label={`Select ${p.ticket_number}`}
                  />
                </td>
                <td>{p.ticket_number}</td>
                <td>{p.customer_name}</td>
                <td>{p.name}</td>
                <td>
                  <button
                    className={'made-toggle ' + (p.is_made ? 'on' : 'off')}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMade(p);
                    }}
                  >
                    {p.is_made ? 'Made' : 'Not made'}
                  </button>
                </td>
                <td>{p.fulfillment}</td>
                <td>{p.delivery_location || '—'}</td>
                <td>{p.address || '—'}</td>
                <td>{p.fulfillment === 'Pickup' ? '—' : money(p.delivery_charge)}</td>
                <td>{money(p.cost)}</td>
                <td>{money(p.price)}</td>
                <td>{money(p.profit)}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <span className="label-flags">
                    <button
                      className={
                        'flag ' + (p.gift_label_printed ? 'on' : 'off')
                      }
                      disabled={busy}
                      title={
                        p.gift_label_printed
                          ? 'Gift label printed — click to clear'
                          : 'Gift label not printed'
                      }
                      onClick={() => toggleFlag(p, 'gift_label_printed')}
                    >
                      G
                    </button>
                    <button
                      className={
                        'flag ' + (p.shipping_label_printed ? 'on' : 'off')
                      }
                      disabled={busy}
                      title={
                        p.shipping_label_printed
                          ? 'Shipping label printed — click to clear'
                          : 'Shipping label not printed'
                      }
                      onClick={() => toggleFlag(p, 'shipping_label_printed')}
                    >
                      S
                    </button>
                  </span>
                </td>
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
                <td colSpan={COLUMNS.length + 4} className="subtle">
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
              deliveryLocations={deliveryLocations}
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

      {labelExport && (
        <LabelExport
          kind={labelExport.kind}
          products={selectedProducts}
          template={templateFor(labelExport.kind)}
          onClose={() => setLabelExport(null)}
          onExported={(ids) => markPrinted(ids, labelExport.kind)}
        />
      )}

      {showSettings && (
        <LabelSettings onClose={() => setShowSettings(false)} onSaved={load} />
      )}
    </div>
  );
}
