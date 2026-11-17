import { useEffect, useState } from 'react';
import { api } from '../api';
import { money, CATEGORIES, categoryOf, EXPENSE_KINDS, todayISO } from '../util';
import { useSeason } from '../season';
import Icon, { CAT_ICON } from './Icon';

// The Inventory tab. Four kinds of stock, each with its own rules, plus a log
// of other spending (expenses). Every section collapses.

const SECTION_INFO = {
  tray: {
    title: 'Trays',
    hint: "Bought once before the season — what you start with is all there is. A tray's stock never goes below zero: an order that needs more than are left can't be submitted. Counts toward breakeven (bought × cost).",
    bought: 'Bought',
    moved: 'Sold',
    money: 'Spent',
  },
  filler: {
    title: 'Filler',
    hint: "Bought once before the season. Running out never blocks an order (you can swap in something else) — it just shows a warning. Counts toward breakeven (bought × cost).",
    bought: 'Bought',
    moved: 'Used',
    money: 'Spent',
  },
  wine: {
    title: 'Wine',
    hint: "You only pay for what sells, so it's not overhead. Stock is tracked so you know what to send back; the cost still counts in each tray's cost, and \"Owed\" is sold × cost. Running out only warns.",
    bought: 'Received',
    moved: 'Sold',
    money: 'Owed',
  },
  grocery: {
    title: 'Grocery',
    hint: "Small items from grocery runs. Unlimited here — no counting. The cost each is an estimate for the tray's cost to make. What you actually spend goes in Expenses below as one bill per run.",
  },
};

// Remember which sections are collapsed (per browser; purely a convenience).
const COLLAPSE_KEY = 'mw.inventory.collapsed';
const readCollapsed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]'));
  } catch {
    return new Set();
  }
};
const writeCollapsed = (set) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable */
  }
};

function CategoryChips({ value, onChange }) {
  return (
    <span className="cat-chips" role="radiogroup" aria-label="Category">
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={value === c.key}
          className={'cat-chip cat-' + c.key + (value === c.key ? ' on' : '')}
          onClick={() => onChange(c.key)}
        >
          <Icon name={CAT_ICON[c.key]} size={15} /> {c.one}
        </button>
      ))}
    </span>
  );
}

// Stock on hand. Zero or below shows in red with a small chip.
function StockQty({ item }) {
  const low = item.quantity <= 0;
  const cat = categoryOf(item);
  const chip = cat === 'tray' ? 'Sold out' : cat === 'wine' ? 'Out' : 'Need to buy';
  return (
    <span className={'stock-qty' + (low ? ' low' : '')}>
      {item.quantity}
      {low && <span className="need-chip">{chip}</span>}
    </span>
  );
}

export function Section({ cat, items, open, onToggle, children, summary }) {
  const info = SECTION_INFO[cat];
  return (
    <section className={'inv-section inv-' + cat}>
      <button type="button" className="inv-head" onClick={onToggle} aria-expanded={open}>
        <span className="fp-caret">{open ? '▾' : '▸'}</span>
        <span className={'cat-chip cat-' + cat + ' on static'}>
          <Icon name={CAT_ICON[cat]} size={16} /> {info.title}
        </span>
        <span className="subtle">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        {summary && <span className="inv-sum">{summary}</span>}
      </button>
      {open && (
        <div className="inv-body">
          <p className="hint">{info.hint}</p>
          {children}
        </div>
      )}
    </section>
  );
}

function MaterialRow({ item, onChanged, onError }) {
  const { readOnly } = useSeason();
  const cat = categoryOf(item);
  const info = SECTION_INFO[cat];
  const counted = cat !== 'grocery';
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setForm({
      name: item.name,
      category: cat,
      cost: String(item.cost),
      quantity: String(item.quantity),
      bought: item.starting_quantity == null ? '' : String(item.starting_quantity),
    });
    setEditing(true);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return onError('Give it a name.');
    if (form.category === 'tray' && (Number(form.quantity) || 0) < 0) {
      return onError("A tray's quantity can't be below zero.");
    }
    setBusy(true);
    try {
      const body = { name: form.name, cost: Number(form.cost) || 0, category: form.category };
      if (form.category !== 'grocery') {
        body.quantity = Number(form.quantity) || 0;
        // Only send "bought" when it was already counted, so a category change
        // can fill it in on its own (stock + already used).
        if (counted || form.bought !== '') {
          body.starting_quantity = form.bought === '' ? null : Number(form.bought);
        }
      }
      await api.patch(`/materials/${item.id}`, body);
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

  const bought = item.starting_quantity;
  const moved = bought == null ? null : bought - item.quantity;
  const moneyCol =
    cat === 'wine'
      ? moved == null
        ? null
        : Math.max(0, moved) * item.cost
      : bought == null
      ? null
      : bought * item.cost;

  if (!editing) {
    return (
      <tr className={'inv-row-' + cat}>
        <td>{item.name}</td>
        <td>{money(item.cost)}</td>
        {counted ? (
          <>
            <td>{bought ?? '—'}</td>
            <td>
              <StockQty item={item} />
            </td>
            <td>{moved ?? '—'}</td>
            <td>{moneyCol == null ? '—' : money(moneyCol)}</td>
          </>
        ) : (
          <td className="inf" title="Unlimited — not counted">∞</td>
        )}
        <td className="right">
          {!readOnly && (
            <>
              <button onClick={startEdit}>Edit</button>
              <button className="danger" onClick={remove}>
                Delete
              </button>
            </>
          )}
        </td>
      </tr>
    );
  }

  const editCounted = form.category !== 'grocery';
  return (
    <tr className={'inv-row-' + cat + ' editing'}>
      <td colSpan={counted ? 6 : 3}>
        <div className="inv-edit">
          <label>
            Name
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <div>
            <div className="fld-label">Category</div>
            <CategoryChips value={form.category} onChange={(v) => set('category', v)} />
          </div>
          <label>
            Cost each
            <input
              type="number"
              step="0.01"
              value={form.cost}
              onChange={(e) => set('cost', e.target.value)}
            />
          </label>
          {editCounted && (
            <>
              <label>
                {SECTION_INFO[form.category].bought}
                <input
                  type="number"
                  min="0"
                  value={form.bought}
                  placeholder={counted ? '' : 'auto'}
                  onChange={(e) => set('bought', e.target.value)}
                />
              </label>
              <label>
                Left in stock
                <input
                  type="number"
                  min={form.category === 'tray' ? 0 : undefined}
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        {form.category !== cat && (
          <p className="hint">
            Moves to {SECTION_INFO[form.category].title}.
            {!counted && editCounted
              ? ' Leave "' + SECTION_INFO[form.category].bought + '" blank to fill it in from stock + what was already used.'
              : ''}
            {form.category === 'tray'
              ? ' As a tray it will cap sales and can never go below zero.'
              : ''}
          </p>
        )}
      </td>
      <td className="right">
        <button className="primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button onClick={() => setEditing(false)}>Cancel</button>
      </td>
    </tr>
  );
}

export function MaterialTable({ cat, items, onChanged, onError }) {
  const info = SECTION_INFO[cat];
  const counted = cat !== 'grocery';
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>{cat === 'grocery' ? 'Est. cost each' : 'Cost each'}</th>
            {counted ? (
              <>
                <th>{info.bought}</th>
                <th>Left</th>
                <th>{info.moved}</th>
                <th>{info.money}</th>
              </>
            ) : (
              <th>Stock</th>
            )}
            <th className="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <MaterialRow key={m.id} item={m} onChanged={onChanged} onError={onError} />
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={counted ? 7 : 4} className="subtle">
                Nothing here yet — add one above and pick “{CATEGORIES.find((c) => c.key === cat).one}”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseRow({ e, onChanged, onError }) {
  const { readOnly } = useSeason();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!(Number(form.amount) > 0)) return onError('Enter the amount spent.');
    setBusy(true);
    try {
      await api.patch(`/expenses/${e.id}`, { ...form, amount: Number(form.amount) });
      setForm(null);
      onError('');
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete this ${money(e.amount)} expense?`)) return;
    try {
      await api.del(`/expenses/${e.id}`);
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  };

  if (!form) {
    return (
      <tr>
        <td>{new Date(e.spent_on + 'T00:00:00').toLocaleDateString()}</td>
        <td>
          <span className="exp-kind">{e.kind}</span>
        </td>
        <td>{e.note || <span className="subtle">—</span>}</td>
        <td className="num">{money(e.amount)}</td>
        <td className="right">
          {!readOnly && (
            <>
              <button
                onClick={() =>
                  setForm({ spent_on: e.spent_on, kind: e.kind, note: e.note, amount: String(e.amount) })
                }
              >
                Edit
              </button>
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
    <tr className="editing">
      <td>
        <input type="date" value={form.spent_on} onChange={(ev) => set('spent_on', ev.target.value)} />
      </td>
      <td>
        <select value={form.kind} onChange={(ev) => set('kind', ev.target.value)}>
          {[...new Set([...EXPENSE_KINDS, form.kind])].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </td>
      <td>
        <input value={form.note} onChange={(ev) => set('note', ev.target.value)} />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(ev) => set('amount', ev.target.value)}
          style={{ width: 100 }}
        />
      </td>
      <td className="right">
        <button className="primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button onClick={() => setForm(null)}>Cancel</button>
      </td>
    </tr>
  );
}

function Expenses({ open, onToggle }) {
  const { readOnly } = useSeason();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const blank = () => ({ spent_on: todayISO(), kind: 'Grocery', note: '', amount: '' });
  const [draft, setDraft] = useState(blank);

  const load = () => api.get('/expenses').then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const add = async (ev) => {
    ev.preventDefault();
    setError('');
    if (!(Number(draft.amount) > 0)) return setError('Enter the amount spent.');
    try {
      await api.post('/expenses', { ...draft, amount: Number(draft.amount) });
      setDraft(blank());
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const total = list.reduce((s, e) => s + e.amount, 0);

  return (
    <section className="inv-section inv-expenses">
      <button type="button" className="inv-head" onClick={onToggle} aria-expanded={open}>
        <span className="fp-caret">{open ? '▾' : '▸'}</span>
        <span className="cat-chip cat-expense on static">
          <Icon name="receipt" size={16} /> Expenses
        </span>
        <span className="subtle">
          {list.length} bill{list.length === 1 ? '' : 's'}
        </span>
        <span className="inv-sum">Total {money(total)}</span>
      </button>
      {open && (
        <div className="inv-body">
          <p className="hint">
            Money spent that isn't counted item by item — a grocery run, packaging,
            supplies, gas. Type in the bill total. Every expense counts toward
            breakeven on the Financials tab.
          </p>
          {!readOnly && (
            <form className="add-bar exp-add" onSubmit={add}>
              <input
                type="date"
                value={draft.spent_on}
                onChange={(e) => setDraft((d) => ({ ...d, spent_on: e.target.value }))}
                aria-label="Date"
              />
              <span className="pill-group">
                {EXPENSE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={draft.kind === k ? 'pill active' : 'pill'}
                    onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                  >
                    {k}
                  </button>
                ))}
              </span>
              <input
                className="exp-note"
                placeholder="Store / what for (optional)"
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              />
              <button className="primary">+ Add expense</button>
            </form>
          )}
          {error && <div className="error">{error}</div>}
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Note</th>
                  <th>Amount</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <ExpenseRow key={e.id} e={e} onChanged={load} onError={setError} />
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="subtle">
                      No expenses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Materials() {
  const { current, readOnly } = useSeason();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const emptyDraft = { name: '', category: 'filler', quantity: '', cost: '', bought: '' };
  const [draft, setDraft] = useState(emptyDraft);

  const load = () => api.get('/materials').then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const toggle = (key) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      writeCollapsed(n);
      return n;
    });

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!draft.name.trim()) return setError('Give it a name.');
    if (draft.category === 'tray' && (Number(draft.quantity) || 0) < 0) {
      return setError("A tray's quantity can't be below zero.");
    }
    try {
      await api.post('/materials', {
        name: draft.name.trim(),
        category: draft.category,
        quantity: Number(draft.quantity) || 0,
        cost: Number(draft.cost) || 0,
        starting_quantity: draft.bought !== '' ? Number(draft.bought) : null,
      });
      setDraft({ ...emptyDraft, category: draft.category });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const byCat = (key) => items.filter((m) => categoryOf(m) === key);
  const spentOf = (key) =>
    byCat(key).reduce((s, m) => s + (m.starting_quantity || 0) * m.cost, 0);
  const owedWine = byCat('wine').reduce(
    (s, m) =>
      s + (m.starting_quantity == null ? 0 : Math.max(0, m.starting_quantity - m.quantity) * m.cost),
    0
  );
  const summaries = {
    tray: `Spent ${money(spentOf('tray'))}`,
    filler: `Spent ${money(spentOf('filler'))}`,
    wine: `Owed ${money(owedWine)}`,
    grocery: 'Unlimited',
  };
  const counted = draft.category !== 'grocery';

  return (
    <div className="panel">
      <h1>Inventory</h1>
      <p className="subtle">
        Everything that goes into a tray, in four kinds with their own rules. "Cost
        each" feeds every product's cost to make. Counts and money shown are for{' '}
        <strong>{current.name}</strong>; names, costs and categories are shared by
        every season.
      </p>

      {!readOnly && (
        <form className="add-bar inv-add" onSubmit={add}>
          <CategoryChips
            value={draft.category}
            onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
          />
          <input
            placeholder="New item name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <input
            type="number"
            step="0.01"
            placeholder={counted ? 'Cost each' : 'Est. cost each'}
            value={draft.cost}
            onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
          />
          {counted && (
            <input
              type="number"
              min={draft.category === 'tray' ? 0 : undefined}
              placeholder={SECTION_INFO[draft.category].bought}
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
              title="How many you have — also saved as the bought amount"
            />
          )}
          <button className="primary">+ Add</button>
        </form>
      )}

      {error && <div className="error">{error}</div>}

      {CATEGORIES.map((c) => (
        <Section
          key={c.key}
          cat={c.key}
          items={byCat(c.key)}
          open={!collapsed.has(c.key)}
          onToggle={() => toggle(c.key)}
          summary={summaries[c.key]}
        >
          <MaterialTable cat={c.key} items={byCat(c.key)} onChanged={load} onError={setError} />
        </Section>
      ))}

      <Expenses open={!collapsed.has('expenses')} onToggle={() => toggle('expenses')} />
    </div>
  );
}
