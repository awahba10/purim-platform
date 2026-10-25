import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useSeason } from '../season';

// Season chip + menu, shown in the sidebar under Financials. Lists every
// season, switches the whole app, starts a New Season, and can delete an
// empty, non-active season (e.g. one made by mistake).
export default function SeasonSwitcher() {
  const s = useSeason();
  const { current, active, seasons, unlocked } = s;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const newSeason = () => {
    setOpen(false);
    const name = window.prompt('Name for the new season (e.g. "Purim 2028"):');
    if (!name || !name.trim()) return;
    if (
      !window.confirm(
        `Start "${name.trim()}"?\n\n${
          active ? `"${active.name}" will be closed (read-only). ` : ''
        }The new season starts empty: no orders, no batches, tickets from T-0001, and all stock at 0. Nothing in past seasons is changed.`
      )
    )
      return;
    run(() => s.createSeason(name.trim()));
  };

  const canDelete = (x) =>
    x.status !== 'Active' && x.order_count === 0 && x.batch_count === 0;

  const remove = (x) => {
    if (!window.confirm(`Delete the empty season "${x.name}"? This can't be undone.`)) return;
    run(async () => {
      await api.del(`/seasons/${x.id}`);
      const list = await s.refresh();
      if (x.id === current.id) {
        const next = list.find((y) => y.status === 'Active') || list[0];
        if (next) s.switchTo(next.id);
      }
    });
  };

  return (
    <div className="season-switcher" ref={wrapRef}>
      <div className="ss-label">Season</div>
      <button
        type="button"
        className={'season-chip ' + (current.status === 'Active' ? 'active' : 'closed')}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="sc-name">{current.name}</span>
        <span className="sc-status">
          {current.status === 'Active' ? 'Active' : unlocked ? 'Unlocked' : '🔒'}
        </span>
        <span className="sc-caret">▾</span>
      </button>

      {open && (
        <div className="chip-menu season-menu" role="listbox">
          {seasons.map((x) => (
            <div key={x.id} className="sm-row">
              <button
                type="button"
                role="option"
                aria-selected={x.id === current.id}
                className={'cm-item' + (x.id === current.id ? ' current' : '')}
                onClick={() => {
                  setOpen(false);
                  if (x.id !== current.id) s.switchTo(x.id);
                }}
              >
                <span className="sm-name">
                  {x.name}
                  {x.id === current.id ? ' ✓' : ''}
                </span>
                <span className={'sm-status ' + (x.status === 'Active' ? 'on' : '')}>
                  {x.status}
                </span>
                <span className="cm-meta">
                  {x.order_count} order{x.order_count === 1 ? '' : 's'}
                </span>
              </button>
              {canDelete(x) && (
                <button
                  type="button"
                  className="sm-del"
                  disabled={busy}
                  title="Delete this empty season"
                  aria-label={`Delete ${x.name}`}
                  onClick={() => remove(x)}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          <button type="button" className="cm-item new" onClick={newSeason}>
            + New Season…
          </button>
        </div>
      )}

      {error && <div className="error ss-error">{error}</div>}
    </div>
  );
}
