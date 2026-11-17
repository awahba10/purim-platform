import { useState } from 'react';

// Reusable collapsible filter panel (opening it shows every category's chips). Used by Products, All Orders, Financials.
//
// props:
//   categories: [{ key, label, options: [{ value, label }] }]
//   state:      { [key]: string[] }   (selected values per category)
//   onChange:   (nextState) => void
export default function FilterPanel({ categories, state, onChange }) {
  const [panelOpen, setPanelOpen] = useState(false);

  const totalSelected = categories.reduce(
    (n, c) => n + (state[c.key] || []).length,
    0
  );

  const toggleChip = (key, value) => {
    const cur = state[key] || [];
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    const nextState = { ...state, [key]: next };
    if (!next.length) delete nextState[key];
    onChange(nextState);
  };

  return (
    <div className="filter-panel">
      <button
        type="button"
        className="fp-bar"
        onClick={() => setPanelOpen((o) => !o)}
      >
        <span className="fp-caret">{panelOpen ? '▾' : '▸'}</span> Filters
        {totalSelected > 0 && <span className="fp-badge">{totalSelected}</span>}
      </button>

      {panelOpen && (
        <div className="fp-body">
          {categories.map((cat) => {
            const sel = state[cat.key] || [];
            return (
              <div className="fp-cat" key={cat.key}>
                <div className="fp-cat-head">
                  <span>{cat.label}</span>
                  {sel.length > 0 && <span className="fp-badge">{sel.length}</span>}
                </div>
                <div className="fp-chips">
                    {cat.options.length === 0 && (
                      <span className="subtle">No options yet</span>
                    )}
                    {cat.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={
                          'filter-chip ' + (sel.includes(o.value) ? 'on' : '')
                        }
                        title={o.label}
                        onClick={() => toggleChip(cat.key, o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}

          {totalSelected > 0 && (
            <button
              type="button"
              className="linkbtn fp-clear"
              onClick={() => onChange({})}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
