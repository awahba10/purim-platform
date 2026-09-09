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
import CreateBatchModal from './CreateBatchModal';
import BatchChip from './BatchChip';

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
  { key: 'batch_name', label: 'Batch' },
  { label: 'Made', get: (p) => (p.is_made ? 'Made' : 'Not made') },
  { label: 'Delivered', get: (p) => (p.is_delivered ? 'Delivered' : '') },
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
  const [batches, setBatches] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [editing, setEditing] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [lastId, setLastId] = useState(null);
  const [labelExport, setLabelExport] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([
      api.get('/products'),
      api.get('/materials'),
      api.get('/delivery-locations'),
      api.get('/label-templates'),
      api.get('/batches'),
    ])
      .then(([p, m, d, t, b]) => {
        setProducts(p);
        setMaterials(m);
        setDeliveryLocations(d);
        setTemplates(t);
        setBatches(b);
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
        [p.name, p.ticket_number, p.customer_name, p.delivery_location, p.address, p.batch_name].some(
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

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)).sort((a, b) => a.id - b.id),
    [products, selected]
  );

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
    setLastId(null);
  };

  const rowClick = (p, e) => {
    if (!selectMode) {
      setEditing({ product: p, draft: productToDraft(p) });
      return;
    }
    setSelected((s) => {
      const next = new Set(s);
      const ids = rows.map((r) => r.id);
      if (e.shiftKey && lastId != null && ids.includes(lastId)) {
        const a = ids.indexOf(lastId);
        const b = ids.indexOf(p.id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let k = lo; k <= hi; k++) next.add(ids[k]);
      } else if (next.has(p.id)) {
        next.delete(p.id);
      } else {
        next.add(p.id);
      }
      return next;
    });
    setLastId(p.id);
  };

  const bulkDelete = async () => {
    if (
      !window.confirm(
        `Delete ${selected.size} product${selected.size === 1 ? '' : 's'}? Their materials go back to stock.`
      )
    )
      return;
    setBusy(true);
    try {
      for (const id of selected) await api.del(`/products/${id}`);
      exitSelect();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startExport = (kind) => {
    setError('');
    if (!selectedProducts.length) return setError('Select some products first.');
    if (!templateFor(kind)) return setError('Label template not loaded yet.');
    setLabelExport({ kind });
  };

  const markPrinted = async (ids, kind) => {
    const field = kind === 'gift' ? 'gift_label_printed' : 'shipping_label_printed';
    for (const id of ids) await api.patch(`/products/${id}`, { [field]: true });
    exitSelect();
    await load();
  };

  const setProductBatch = async (p, batchId) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/products/${p.id}`, { batch_id: batchId });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createBatchFor = async (p) => {
    const name = window.prompt('Name for the new batch:');
    if (!name || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/batches', { name: name.trim(), product_ids: [p.id] });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
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

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Products</h1>
        <div className="ph-actions">
          <button
            className={selectMode ? 'primary' : ''}
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
          <button
            className="icon-btn gear"
            title="Label settings"
            aria-label="Label settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙
          </button>
          <button onClick={exportCsv} disabled={products.length === 0}>
            Export CSV
          </button>
        </div>
      </div>
      <p className="subtle">
        Every product from every order — one row each. Editing a row changes the same
        record the order shows. Use <strong>Select</strong> to pick rows for bulk
        actions (click a row, shift-click another to select the range).
      </p>

      <div className="row-between">
        <input
          className="search"
          placeholder="Search by product, ticket, customer, batch, location, or address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {selectMode && selected.size > 0 && (
        <div className="action-bar">
          <span>{selected.size} selected</span>
          <button className="danger" onClick={bulkDelete} disabled={busy}>
            Delete
          </button>
          <button onClick={() => startExport('gift')}>Export Gift Labels</button>
          <button onClick={() => startExport('shipping')}>
            Export Shipping Labels
          </button>
          <button className="primary" onClick={() => setShowBatchModal(true)}>
            Create Batch
          </button>
          <button onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

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
              <th>Labels</th>
              <th>Batch</th>
              <th>Materials</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={
                  (selectMode ? 'selectable ' : '') +
                  (selectMode && selected.has(p.id) ? 'row-selected' : '')
                }
                onMouseDown={(e) => {
                  if (selectMode && e.shiftKey) e.preventDefault();
                }}
                onClick={(e) => rowClick(p, e)}
              >
                <td>{p.ticket_number}</td>
                <td>{p.customer_name}</td>
                <td>{p.name}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className={'made-toggle ' + (p.is_made ? 'on' : 'off')}
                    disabled={busy}
                    onClick={() => toggleMade(p)}
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
                      className={'flag ' + (p.gift_label_printed ? 'on' : 'off')}
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
                      className={'flag ' + (p.shipping_label_printed ? 'on' : 'off')}
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
                <td onClick={(e) => e.stopPropagation()}>
                  <BatchChip
                    value={p.batch_id}
                    currentName={p.batch_name}
                    batches={batches}
                    disabled={busy}
                    onAssign={(bid) => setProductBatch(p, bid)}
                    onCreateAssign={() => createBatchFor(p)}
                    onRemove={() => setProductBatch(p, null)}
                  />
                </td>
                <td className="subtle">
                  {p.materials.length
                    ? p.materials
                        .map((m) => `${m.material_name} ×${m.quantity_used}`)
                        .join(', ')
                    : '—'}
                </td>
                <td className="right" onClick={(e) => e.stopPropagation()}>
                  <button className="danger" onClick={() => remove(p)}>
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

      {showBatchModal && (
        <CreateBatchModal
          productIds={selectedProducts.map((p) => p.id)}
          onClose={() => setShowBatchModal(false)}
          onDone={() => {
            setShowBatchModal(false);
            exitSelect();
            load();
          }}
        />
      )}
    </div>
  );
}
