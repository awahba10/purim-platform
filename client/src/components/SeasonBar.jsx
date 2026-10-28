import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../season';

// Top-of-page closed-season banner and new-season prompt. (The season
// switcher itself lives in the sidebar — see SeasonSwitcher.)
export default function SeasonBar() {
  const s = useSeason();
  const { current, active, unlocked } = s;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  if (current.status !== 'Closed' && !s.notice && !error) return null;

  return (
    <div className="season-area">
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
            <Link to="/inventory" onClick={s.dismissNotice}>
              Inventory tab
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
