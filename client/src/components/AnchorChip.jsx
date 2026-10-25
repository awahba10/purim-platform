import { useEffect, useRef, useState } from 'react';

// Tray chip + popup, styled like the batch chip. Lists only limiting-stock
// materials, each with its remaining count. Used as the premade product's
// "Anchor tray" and as a product's "Tray" field. `disableSoldOut` stops a
// sold-out tray being picked (the current one always stays shown).
export default function AnchorChip({
  value,
  trays,
  onPick,
  disabled,
  placeholder = 'Choose anchor tray',
  noneLabel = 'No anchor tray',
  disableSoldOut = false,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        !e.target.closest('.chip-menu')
      ) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: Math.min(r.left, window.innerWidth - 240), top: r.bottom + 4 });
    setOpen(true);
  };

  const pick = (id) => (e) => {
    e.stopPropagation();
    setOpen(false);
    if (id !== value) onPick(id);
  };

  const current = trays.find((t) => t.id === value);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'chip-toggle ' + (current ? 'set' : 'unset')}
        disabled={disabled}
        onClick={toggle}
      >
        {current ? current.name : placeholder}
      </button>

      {open && pos && (
        <div
          className="chip-menu"
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {trays.length === 0 && (
            <div className="cm-empty">
              No limiting-stock materials yet — flag a tray as “Limiting stock” on
              the Materials tab.
            </div>
          )}
          {trays.map((t) => {
            const out = t.quantity <= 0;
            const blocked = disableSoldOut && out && t.id !== value;
            return (
              <button
                key={t.id}
                type="button"
                className={
                  'cm-item' + (t.id === value ? ' current' : '') + (blocked ? ' sold-out' : '')
                }
                disabled={blocked}
                title={blocked ? 'Sold out — no trays remaining' : undefined}
                onClick={pick(t.id)}
              >
                {t.name},
                <span className={'cm-meta' + (out ? ' out' : '')}>
                  {out ? 'sold out' : `${t.quantity} left`}
                </span>
                {t.id === value ? ' ✓' : ''}
              </button>
            );
          })}
          {value != null && (
            <button type="button" className="cm-item danger" onClick={pick(null)}>
              {noneLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
