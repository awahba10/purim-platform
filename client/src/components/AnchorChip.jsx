import { useEffect, useRef, useState } from 'react';

// "Anchor tray" chip + popup for a premade product, styled like the batch chip.
// Lists only limiting-stock materials, each with its remaining count.
export default function AnchorChip({ value, trays, onPick, disabled }) {
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
        {current ? current.name : 'Choose anchor tray'}
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
          {trays.map((t) => (
            <button
              key={t.id}
              type="button"
              className={'cm-item' + (t.id === value ? ' current' : '')}
              onClick={pick(t.id)}
            >
              {t.name}
              <span className={'cm-meta' + (t.quantity <= 0 ? ' out' : '')}>
                {t.quantity <= 0 ? 'Sold out' : `${t.quantity} left`}
              </span>
              {t.id === value ? ' ✓' : ''}
            </button>
          ))}
          {value != null && (
            <button type="button" className="cm-item danger" onClick={pick(null)}>
              No anchor tray
            </button>
          )}
        </div>
      )}
    </>
  );
}
