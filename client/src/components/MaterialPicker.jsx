import { useMemo, useState } from 'react';
import { money } from '../util';

// Searchable material selector. `value` is [{ material_id, quantity_used }].
export default function MaterialPicker({ catalog, value, onChange }) {
  const [q, setQ] = useState('');

  const byId = useMemo(() => {
    const m = {};
    for (const x of catalog) m[x.id] = x;
    return m;
  }, [catalog]);

  const selectedIds = new Set(value.map((v) => v.material_id));

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return catalog
      .filter((m) => !selectedIds.has(m.id) && m.name.toLowerCase().includes(needle))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, q, value]);

  const add = (id) => {
    onChange([...value, { material_id: id, quantity_used: 1 }]);
    setQ('');
  };
  const setQty = (id, qty) =>
    onChange(value.map((v) => (v.material_id === id ? { ...v, quantity_used: qty } : v)));
  const remove = (id) => onChange(value.filter((v) => v.material_id !== id));

  return (
    <div className="mp">
      <input
        className="mp-search"
        placeholder="Search materials to add…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && (
        <div className="mp-results">
          {results.length === 0 && <div className="mp-empty">No matching materials</div>}
          {results.map((m) => (
            <button type="button" key={m.id} className="mp-result" onClick={() => add(m.id)}>
              <span>{m.name}</span>
              <span className="subtle">
                {money(m.cost)} each · {m.quantity} in stock
              </span>
            </button>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="mp-selected">
          {value.map((v) => {
            const m = byId[v.material_id];
            const line = (m ? Number(m.cost) : 0) * (Number(v.quantity_used) || 0);
            return (
              <div className="mp-row" key={v.material_id}>
                <span className="mp-name">{m ? m.name : `#${v.material_id}`}</span>
                <input
                  className="mp-qty"
                  type="number"
                  min="1"
                  value={v.quantity_used}
                  onChange={(e) => setQty(v.material_id, e.target.value)}
                />
                <span className="subtle mp-unit">× {money(m ? m.cost : 0)}</span>
                <span className="mp-line">{money(line)}</span>
                <button
                  type="button"
                  className="mp-x"
                  aria-label="Remove material"
                  onClick={() => remove(v.material_id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
