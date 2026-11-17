import { useEffect, useRef, useState } from 'react';

// A generic single-select chip + popup in the same style as the batch and
// tray chips. options: [{ id, label }]. Picking the current one does nothing;
// "noneLabel" clears it.
export default function PickChip({
  value,
  options,
  onPick,
  placeholder = 'Choose…',
  noneLabel = 'None',
  emptyText = 'Nothing to choose yet',
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) && !e.target.closest('.chip-menu')) {
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
    if (open) return setOpen(false);
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: Math.min(r.left, window.innerWidth - 240), top: r.bottom + 4 });
    setOpen(true);
  };
  const pick = (id) => (e) => {
    e.stopPropagation();
    setOpen(false);
    if (id !== value) onPick(id);
  };
  const current = options.find((o) => o.id === value);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'chip-toggle ' + (current ? 'set' : 'unset')}
        disabled={disabled}
        onClick={toggle}
      >
        {current ? current.label : placeholder}
      </button>
      {open && pos && (
        <div
          className="chip-menu"
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.length === 0 && <div className="cm-empty">{emptyText}</div>}
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={'cm-item' + (o.id === value ? ' current' : '')}
              onClick={pick(o.id)}
            >
              {o.label}
              {o.id === value ? ' ✓' : ''}
            </button>
          ))}
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
