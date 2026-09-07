import { useEffect, useState } from 'react';
import { api } from '../api';

function MaterialRow({ item, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/materials/${item.id}`, {
        name,
        quantity: Number(qty) || 0,
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
      await api.del(`/materials/${item.id}`);
      onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  if (!editing) {
    return (
      <tr>
        <td>{item.name}</td>
        <td className={item.quantity < 0 ? 'neg' : ''}>{item.quantity}</td>
        <td className="right">
          <button onClick={() => setEditing(true)}>Edit</button>
          <button className="danger" onClick={remove}>
            Delete
          </button>
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
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ width: '90px' }}
        />
      </td>
      <td className="right">
        <button className="primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setName(item.name);
            setQty(item.quantity);
          }}
        >
          Cancel
        </button>
      </td>
    </tr>
  );
}

export default function Materials() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', quantity: '' });

  const load = () =>
    api.get('/materials').then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!draft.name.trim()) return;
    try {
      await api.post('/materials', {
        name: draft.name.trim(),
        quantity: Number(draft.quantity) || 0,
      });
      setDraft({ name: '', quantity: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <h1>Materials</h1>
      <p className="subtle">
        Supplies you have on hand. Quantities drop automatically when an order is
        created.
      </p>

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
        <button className="primary">+ Add material</button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>In stock</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <MaterialRow
                key={m.id}
                item={m}
                onChanged={load}
                onError={setError}
              />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="subtle">
                  No materials yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
