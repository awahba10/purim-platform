import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { money, suggestedCostOf, qtyOf } from '../util';
import MaterialPicker from './MaterialPicker';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'cost', label: 'Cost' },
  { key: 'price', label: 'Price' },
];

const NUMERIC = new Set(['cost', 'price']);

function emptyDraft() {
  return { name: '', price: '', materials: [] };
}

function presetToDraft(p) {
  return {
    name: p.name || '',
    price: String(p.price ?? ''),
    materials: (p.materials || []).map((m) => ({
      material_id: m.material_id,
      quantity_used: m.quantity_used,
    })),
  };
}

export default function Premade() {
  const [presets, setPresets] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [editing, setEditing] = useState(null); // { preset?, draft }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.get('/presets'), api.get('/materials')])
      .then(([p, m]) => {
        setPresets(p);
        setMaterials(m);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = presets;
    if (needle) {
      list = list.filter((p) => (p.name || '').toLowerCase().includes(needle));
    }
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (NUMERIC.has(key)) {
        av = Number(av);
        bv = Number(bv);
      } else {
        av = (av == null ? '' : String(av)).toLowerCase();
        bv = (bv == null ? '' : String(bv)).toLowerCase();
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [presets, query, sort]);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );

  const save = async () => {
    const d = editing.draft;
    if (!d.name.trim()) return setError('Give the preset a name.');
    setBusy(true);
    setError('');
    const body = {
      name: d.name.trim(),
      price: Number(d.price) || 0,
      materials: d.materials.map((m) => ({
        material_id: m.material_id,
        quantity_used: qtyOf(m.quantity_used),
      })),
    };
    try {
      if (editing.preset) await api.patch(`/presets/${editing.preset.id}`, body);
      else await api.post('/presets', body);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete preset "${p.name}"?`)) return;
    try {
      await api.del(`/presets/${p.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const draftCost = editing
    ? suggestedCostOf(editing.draft.materials, materials)
    : 0;

  return (
    <div className="panel">
      <h1>Premade Products</h1>
      <p className="subtle">
        Reusable recipes to speed up New Order. Pick one while adding a product and
        it fills in the name, materials, cost, and price — all still editable. These
        do not hold stock and are not part of order or inventory logic.
      </p>

      <button
        className="primary"
        onClick={() => setEditing({ draft: emptyDraft() })}
      >
        + New preset
      </button>

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
                onClick={() => setEditing({ preset: p, draft: presetToDraft(p) })}
              >
                <td>{p.name}</td>
                <td>{money(p.cost)}</td>
                <td>{money(p.price)}</td>
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
                  No presets yet.
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
              <h2>{editing.preset ? 'Edit preset' : 'New preset'}</h2>
              <button
                className="icon-btn"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="product-fields">
              <label>
                Name
                <input
                  value={editing.draft.name}
                  onChange={(e) =>
                    setEditing((c) => ({
                      ...c,
                      draft: { ...c.draft, name: e.target.value },
                    }))
                  }
                  placeholder="Classic tray"
                />
              </label>

              <div>
                <div className="subtle" style={{ marginBottom: 6 }}>Materials used</div>
                <MaterialPicker
                  catalog={materials}
                  value={editing.draft.materials}
                  onChange={(next) =>
                    setEditing((c) => ({ ...c, draft: { ...c.draft, materials: next } }))
                  }
                />
              </div>

              <div className="row">
                <label>
                  Cost (auto)
                  <input value={money(draftCost)} readOnly />
                  <span className="hint">Summed from the materials above.</span>
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    step="0.01"
                    value={editing.draft.price}
                    onChange={(e) =>
                      setEditing((c) => ({
                        ...c,
                        draft: { ...c.draft, price: e.target.value },
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button className="primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save preset'}
              </button>
              <button onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
