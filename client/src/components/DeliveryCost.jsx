import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../util';
import { useSeason } from '../season';

function LocationRow({ item, onChanged, onError }) {
  const { readOnly } = useSeason();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [cost, setCost] = useState(item.cost);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(item.name);
    setCost(item.cost);
    setEditing(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/delivery-locations/${item.id}`, {
        name,
        cost: Number(cost) || 0,
      });
      setEditing(false);
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
      await api.del(`/delivery-locations/${item.id}`);
      onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  if (!editing) {
    return (
      <tr>
        <td>{item.name}</td>
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
    <tr>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{ width: '110px' }}
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

// One brand row: shows how many products carry it; rename / delete.
function BrandRow({ item, onChanged, onError }) {
  const { readOnly } = useSeason();
  const [name, setName] = useState(null);
  const save = async () => {
    if (!name.trim()) return onError('Give the brand a name.');
    try {
      await api.patch(`/brands/${item.id}`, { name: name.trim() });
      setName(null);
      onError('');
      onChanged();
    } catch (e) {
      onError(e.message);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the brand "${item.name}"?`)) return;
    try {
      await api.del(`/brands/${item.id}`);
      onChanged();
    } catch (e) {
      onError(e.message);
    }
  };
  if (name === null) {
    return (
      <tr>
        <td>{item.name}</td>
        <td>{item.product_count}</td>
        <td className="right">
          {!readOnly && (
            <>
              <button onClick={() => setName(item.name)}>Rename</button>
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
    <tr>
      <td colSpan={2}>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </td>
      <td className="right">
        <button className="primary" onClick={save}>
          Save
        </button>
        <button onClick={() => setName(null)}>Cancel</button>
      </td>
    </tr>
  );
}

function Brands() {
  const { readOnly } = useSeason();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const load = () => api.get('/brands').then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    try {
      await api.post('/brands', { name: name.trim() });
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <section className="lb-section">
      <h2>Brands</h2>
      <p className="subtle">
        Names you can tag a product with (one per product), on New Order or when
        editing a product. A premade product can carry a default brand. Financials
        shows the split by brand, the same way it shows locations. Renaming a brand
        updates every product tagged with it; a brand that's in use can't be
        deleted.
      </p>
      {!readOnly && (
        <form className="add-bar" onSubmit={add}>
          <input
            placeholder="New brand name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="primary">+ Add brand</button>
        </form>
      )}
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Products tagged</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <BrandRow key={b.id} item={b} onChanged={load} onError={setError} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="subtle">
                  No brands yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DeliveryCost() {
  const { readOnly } = useSeason();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', cost: '' });

  const load = () =>
    api.get('/delivery-locations').then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!draft.name.trim()) return;
    try {
      await api.post('/delivery-locations', {
        name: draft.name.trim(),
        cost: Number(draft.cost) || 0,
      });
      setDraft({ name: '', cost: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <h1>Locations &amp; Brands</h1>
      <h2>Delivery locations</h2>
      <p className="subtle">
        A reference list of delivery locations and what they roughly cost. This is
        informational only — the cost here is never applied automatically. When
        creating an order, the location names appear in the delivery location picker,
        and the delivery charge is chosen manually each time.
      </p>

      {!readOnly && (
      <form className="add-bar" onSubmit={add}>
        <input
          placeholder="New location name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Reference cost"
          value={draft.cost}
          onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
        />
        <button className="primary">+ Add location</button>
      </form>
      )}

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Location</th>
              <th>Reference cost</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <LocationRow
                key={l.id}
                item={l}
                onChanged={load}
                onError={setError}
              />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="subtle">
                  No delivery locations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Brands />
    </div>
  );
}
