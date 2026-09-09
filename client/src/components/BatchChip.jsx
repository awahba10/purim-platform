import { useEffect, useRef, useState } from 'react';

// A chip (styled like the Made/Not-made chips) that opens a small popup for
// assigning / reassigning / removing a product's delivery batch. Used on the
// Products tab and inside a batch's detail view.
export default function BatchChip({
  value, // current batch_id or null
  currentName, // current batch_name or null
  batches, // [{ id, name }]
  onAssign, // (batchId) => void
  onCreateAssign, // () => void   (parent prompts for a name + creates + assigns)
  onRemove, // () => void
  disabled,
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
    setPos({ left: Math.min(r.left, window.innerWidth - 220), top: r.bottom + 4 });
    setOpen(true);
  };

  const pick = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'chip-toggle ' + (value ? 'set' : 'unset')}
        disabled={disabled}
        onClick={toggle}
      >
        {currentName || 'Assign to Batch'}
      </button>

      {open && pos && (
        <div
          className="chip-menu"
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {batches.length === 0 && (
            <div className="cm-empty">No batches yet</div>
          )}
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={'cm-item' + (b.id === value ? ' current' : '')}
              onClick={pick(() => b.id !== value && onAssign(b.id))}
            >
              {b.name}
              {b.id === value ? ' ✓' : ''}
            </button>
          ))}
          <button type="button" className="cm-item new" onClick={pick(onCreateAssign)}>
            + New batch…
          </button>
          {value && (
            <button
              type="button"
              className="cm-item danger"
              onClick={pick(onRemove)}
            >
              Remove from batch
            </button>
          )}
        </div>
      )}
    </>
  );
}
