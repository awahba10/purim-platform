import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../season';

// Top-of-page season switcher, closed-season banner, and new-season prompt.
export default function SeasonBar() {
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

  const unlock = () => {
    if (
      window.confirm(
        `Unlock "${current.name}" for editing?\n\nChanges will be saved to this closed season. It locks again when you switch seasons or click "Lock again".`
      )
    )
      s.unlock();
  };

  const reopen = () => {
    if (
      window.confirm(
        `Make "${current.name}" the active season?${
          active && active.id !== current.id ? `\n\n"${active.name}" will be closed.` : ''
        }`
      )
    )
      run(() => s.reopen(current.id));
  };

  return (
    <div className="season-area">
      <div className="season-bar" ref={wrapRef}>
        <button
          type="button"
          className={'season-chip ' + (current.status === 'Active' ? 'active' : 'closed')}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="sc-name">{current.name}</span>
          <span className="sc-status">
            {current.status === 'Active' ? 'Active' : unlocked ? 'Closed · unlocked' : 'Closed 🔒'}
          </span>
          <span className="sc-caret">▾</span>
        </button>

        {open && (
          <div className="chip-menu season-menu" role="listbox">
            {seasons.map((x) => (
              <button
                key={x.id}
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
            ))}
            <button type="button" className="cm-item new" onClick={newSeason}>
              + New Season…
            </button>
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {current.status === 'Closed' && (
        <div className={'season-banner ' + (unlocked ? 'unlocked' : 'locked')}>
          <span>
            {unlocked ? (
              <>
                ✏️ Editing <strong>{current.name}</strong> (a closed season) — changes are
                saved to this season.
              </>
            ) : (
              <>
                🔒 Viewing <strong>{current.name}</strong>, locked
              </>
            )}
          </span>
          <span className="sb-actions">
            {unlocked ? (
              <button className="btn-sm" onClick={s.lock}>
                Lock again
              </button>
            ) : (
              <button className="btn-sm primary" onClick={unlock}>
                Unlock to edit
              </button>
            )}
            <button className="btn-sm" disabled={busy} onClick={reopen}>
              Reopen as active season
            </button>
          </span>
        </div>
      )}

      {s.notice && s.notice.kind === 'new-season' && (
        <div className="notice season-notice">
          <span>
            🎉 <strong>{s.notice.name}</strong> has started. Every stock count is at 0 —
            enter your starting quantities in the{' '}
            <Link to="/materials" onClick={s.dismissNotice}>
              Materials tab
            </Link>
            , especially the trays (stock and starting quantity).
          </span>
          <button className="btn-sm" onClick={s.dismissNotice}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
