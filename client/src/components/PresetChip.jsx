import { useEffect, useRef, useState } from 'react';
import { money } from '../util';

// "Select Preset" chip + popup, matching the batch-assignment chip. Picking a
// preset fires onPick(preset); the chip itself has no persistent selected state.
export default function PresetChip({ presets, onPick, disabled }) {
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="chip-toggle unset"
        disabled={disabled}
        onClick={toggle}
      >
        Select Preset
      </button>

      {open && pos && (
        <div
          className="chip-menu"
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {(!presets || presets.length === 0) && (
            <div className="cm-empty">No premade products yet</div>
          )}
          {(presets || []).map((p) => (
            <button
              key={p.id}
              type="button"
              className="cm-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onPick(p);
              }}
            >
              {p.name} ({money(p.price)})
            </button>
          ))}
        </div>
      )}
    </>
  );
}
