import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../util';
import { useSeason } from '../season';

// Current stock. Zero or below shows in red with a small chip: trays are
// "Sold out" (they never go negative); regular materials say "Need to buy".
function StockQty({ item }) {
  const low = item.quantity <= 0;
  return (
    <span className={'stock-qty' + (low ? ' low' : '')}>
      {item.quantity}
      {low && (
        <span className="need-chip">{item.is_limiting ? 'Sold out' : 'Need to buy'}</span>
      )}
    </span>
  );
}

function MaterialTable({ title, hint, items, onChanged, onError, empty }) {
  return (
    <section className="mat-section">
      <h3>
        {title} <span className="subtle">({items.length})</span>
      </h3>
      {hint && <p className="hint">{hint}</p>}
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>In stock</th>
              <th>Starting qty</th>
              <th>Cost each</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <MaterialRow key={m.id} item={m} onChanged={onChanged} onError={onError} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="subtle">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MaterialRow({ item, onChanged, onError }) {
  const { readOnly } = useSeason();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity);
  const [cost, setCost] = useState(item.cost);
  const [limiting, setLimiting] = useState(item.is_limiting);
  const [start, setStart] = useState(item.starting_quantity ?? '');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(item.name);
    setQty(item.quantity);
    setCost(item.cost);
    setLimiting(item.is_limiting);
    setStart(item.starting_quantity ?? '');
    setEditing(false);
  };

  // Turning "Limiting" on pre-fills the starting quantity with current stock.
  const toggleLimiting = () => {
    if (!limiting && start === '') setStart(qty);
    setLimiting((v) => !v);
  };

  const save = async () => {
    if (limiting && (Number(qty) || 0) < 0) {
      onError("A tray's quantity can't be below zero.");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/materials/${item.id}`, {
        name,
        quantity: Number(qty) || 0,
        cost: Number(cost) || 0,
        is_limiting: limiting,
        ...(limiting ? { starting_quantity: start === '' ? null : Number(start) } : {}),
      });
      setEditing(false);
      onError('');
      onChanged();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.del(`/materials/${item.id}`);
      onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  if (!editing) {
    return (
      <tr className={item.is_limiting ? 'limit-row' : ''}>
        <td>
          {item.name}
          {item.is_limiting && <span className="limit-tag">Limiting</span>}
        </td>
        <td>
          <StockQty item={item} />
        </td>
        <td>{item.is_limiting ? item.starting_quantity ?? '—' : '—'}</td>
        <td>{money(item.cost)}</td>
        <td className="right">
          {!readOnly && (
            <>
              <button onClick={() => setEditing(true)}>Edit</button>
              <button className="danger" onClick={remove}>
                Delete
              </button>
            </>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className={item.is_limiting ? 'limit-row' : ''}>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className={'limit-toggle' + (limiting ? ' on' : '')}
          onClick={toggleLimiting}
          title="Limiting stock caps how many of a product can be sold (e.g. trays)"
        >
          {limiting ? '✓ Limiting stock' : '+ Limiting stock'}
        </button>
      </td>
      <td>
        <input
          type="number"
          min={limiting ? 0 : undefined}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ width: '90px' }}
        />
      </td>
      <td>
        {limiting ? (
          <input
            type="number"
            min="0"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="Bought"
            style={{ width: '90px' }}
          />
        ) : (
          <span className="subtle">—</span>
        )}
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{ width: '90px' }}
        />
      </td>
      <td className="right">
        <button className="primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button onClick={reset}>Cancel</button>
      </td>
    </tr>
  );
}

export default function Materials() {
  const { current, readOnly } = useSeason();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const emptyDraft = { name: '', quantity: '', cost: '', is_limiting: false, starting_quantity: '' };
  const [draft, setDraft] = useState(emptyDraft);

  const load = () =>
    api.get('/materials').then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!draft.name.trim()) return;
    if (draft.is_limiting && (Number(draft.quantity) || 0) < 0) {
      return setError("A tray's quantity can't be below zero.");
    }
    try {
      await api.post('/materials', {
        name: draft.name.trim(),
        quantity: Number(draft.quantity) || 0,
        cost: Number(draft.cost) || 0,
        is_limiting: draft.is_limiting,
        starting_quantity:
          draft.is_limiting && draft.starting_quantity !== ''
            ? Number(draft.starting_quantity)
            : null,
      });
      setDraft(emptyDraft);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <h1>Materials</h1>
      <p className="subtle">
        Supplies on hand. "Cost" is the price per unit — it feeds each product's
        suggested cost. Stock drops automatically when a product uses a material.
        Mark bulk-bought items like trays as <strong>Limiting stock</strong> — they
        cap how many of a premade product can be sold, and their starting quantity
        (how many you bought) drives sell-through on Financials.
      </p>

      <p className="hint">
        Stock counts and starting quantities shown are for <strong>{current.name}</strong>.
        Names, costs and the Limiting flag are shared by every season.
      </p>

      {!readOnly && (
      <form className="add-bar" onSubmit={add}>
        <input
          placeholder="New material name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Qty"
          value={draft.quantity}
          onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Cost each"
          value={draft.cost}
          onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
        />
        <button
          type="button"
          className={'limit-toggle' + (draft.is_limiting ? ' on' : '')}
          onClick={() => setDraft((d) => ({ ...d, is_limiting: !d.is_limiting }))}
          title="Limiting stock caps how many of a product can be sold (e.g. trays)"
        >
          {draft.is_limiting ? '✓ Limiting stock' : '+ Limiting stock'}
        </button>
        {draft.is_limiting && (
          <input
            type="number"
            min="0"
            className="start-qty"
            placeholder="Starting qty (bought)"
            value={draft.starting_quantity}
            onChange={(e) =>
              setDraft((d) => ({ ...d, starting_quantity: e.target.value }))
            }
          />
        )}
        <button className="primary">+ Add material</button>
      </form>
      )}

      {error && <div className="error">{error}</div>}

      <MaterialTable
        title="Limiting Stock (Trays)"
        hint="Trays cap how many products can be sold. Their stock never goes below zero — an order that needs more trays than are left can't be submitted."
        items={items.filter((m) => m.is_limiting)}
        onChanged={load}
        onError={setError}
        empty="No limiting-stock materials yet — edit a material and turn on “Limiting stock”."
      />
      <MaterialTable
        title="Other Materials"
        hint="Regular supplies never block an order. If one runs out its stock goes negative and is flagged “Need to buy”."
        items={items.filter((m) => !m.is_limiting)}
        onChanged={load}
        onError={setError}
        empty="No other materials yet."
      />
    </div>
  );
}
