import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { buildMapsRouteUrl } from '../util';
import BatchChip from './BatchChip';
import ShareButton from './ShareButton';

const coarsePointer =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(pointer: coarse)').matches;

export default function BatchDetail({ id, onBack, onChanged }) {
  const [batch, setBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const [dragId, setDragId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [touchDragging, setTouchDragging] = useState(false);

  const listRef = useRef(null);
  const dragIdRef = useRef(null);
  const dropIndexRef = useRef(null);
  const touchDraggingRef = useRef(false);
  const lpTimer = useRef(null);
  const touchStart = useRef(null);
  const reorderRef = useRef(() => {});
  dragIdRef.current = dragId;
  dropIndexRef.current = dropIndex;
  touchDraggingRef.current = touchDragging;

  const load = () =>
    Promise.all([api.get(`/batches/${id}`), api.get('/batches')])
      .then(([b, list]) => {
        setBatch(b);
        setBatches(list);
        setNameDraft(b.name);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const bubble = () => {
    load();
    if (onChanged) onChanged();
  };

  const persistOrder = async (orderedIds) => {
    setBusy(true);
    setError('');
    try {
      const updated = await api.patch(`/batches/${id}/order`, {
        product_ids: orderedIds,
      });
      setBatch(updated);
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const move = (index, delta) => {
    const ids = batch.products.map((p) => p.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    persistOrder(ids);
  };

  // Move `draggedId` so it lands at array position `insertIdx` (0..len).
  const reorder = (draggedId, insertIdx) => {
    if (!batch) return;
    const ids = batch.products.map((p) => p.id);
    const from = ids.indexOf(draggedId);
    if (from === -1) return;
    ids.splice(from, 1);
    let to = from < insertIdx ? insertIdx - 1 : insertIdx;
    to = Math.max(0, Math.min(ids.length, to));
    if (to === from) return; // no change
    ids.splice(to, 0, draggedId);
    persistOrder(ids);
  };
  reorderRef.current = reorder;

  const endDrag = () => {
    setDragId(null);
    setDropIndex(null);
    setTouchDragging(false);
  };

  // ---- mouse drag ----
  const onRowDragStart = (e, pid) => {
    setDragId(pid);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', String(pid));
      } catch (_) {
        /* ignore */
      }
    }
  };
  const onRowDragOver = (e, idx) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    setDropIndex(e.clientY < r.top + r.height / 2 ? idx : idx + 1);
  };
  const onRowDrop = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (dragId != null && dropIndex != null) reorder(dragId, dropIndex);
    endDrag();
  };

  // ---- touch drag: long-press to pick up, then drag ----
  const onRowTouchStart = (e, pid) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    clearTimeout(lpTimer.current);
    lpTimer.current = setTimeout(() => {
      setDragId(pid);
      setTouchDragging(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch (_) {
          /* ignore */
        }
      }
    }, 300);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const computeDropIndex = (y) => {
      const rows = [...el.querySelectorAll('.batch-row')];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return i;
      }
      return rows.length;
    };

    const onMove = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      if (!touchDraggingRef.current) {
        const s = touchStart.current;
        if (s && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 12) {
          clearTimeout(lpTimer.current); // moved first -> treat as a scroll
        }
        return;
      }
      e.preventDefault(); // stop the page scrolling while dragging
      setDropIndex(computeDropIndex(t.clientY));
    };
    const onEnd = () => {
      clearTimeout(lpTimer.current);
      if (touchDraggingRef.current) {
        const dg = dragIdRef.current;
        const di = dropIndexRef.current;
        endDrag();
        if (dg != null && di != null) reorderRef.current(dg, di);
      }
      touchStart.current = null;
    };

    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [batch]);

  const toggleDelivered = async (p) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/products/${p.id}`, { is_delivered: !p.is_delivered });
      bubble();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeFromBatch = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from this batch?`)) return;
    setBusy(true);
    try {
      await api.del(`/batches/${id}/products/${p.id}`);
      bubble();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const moveToBatch = async (p, targetId) => {
    setBusy(true);
    try {
      await api.patch(`/products/${p.id}`, { batch_id: targetId });
      bubble();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createBatchFor = async (p) => {
    const name = window.prompt('Name for the new batch:');
    if (!name || !name.trim()) return;
    setBusy(true);
    try {
      await api.post('/batches', { name: name.trim(), product_ids: [p.id] });
      bubble();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!nameDraft.trim()) return;
    try {
      await api.patch(`/batches/${id}`, { name: nameDraft.trim() });
      setRenaming(false);
      bubble();
    } catch (e) {
      setError(e.message);
    }
  };

  const routeUrl = batch
    ? buildMapsRouteUrl(batch.products.map((p) => p.address))
    : null;

  const draggedIndex =
    dragId == null || !batch
      ? -1
      : batch.products.findIndex((p) => p.id === dragId);
  const showDropLine = (i) =>
    dragId != null &&
    dropIndex === i &&
    i !== draggedIndex &&
    i !== draggedIndex + 1;

  return (
    <div className="panel">
      <button className="btn-sm" onClick={onBack}>
        ← All batches
      </button>

      {error && <div className="error">{error}</div>}
      {!batch && <p className="subtle">Loading…</p>}

      {batch && (
        <>
          <div className="panel-head">
            {renaming ? (
              <span className="row-between" style={{ gap: 8 }}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  style={{ maxWidth: 260 }}
                />
                <button className="primary" onClick={saveName}>
                  Save
                </button>
                <button onClick={() => setRenaming(false)}>Cancel</button>
              </span>
            ) : (
              <h1>
                {batch.name}{' '}
                <button className="btn-sm" onClick={() => setRenaming(true)}>
                  Rename
                </button>
              </h1>
            )}
            <span className="ph-actions">
              <ShareButton
                path={`/batches/${id}`}
                title={`Delivery batch: ${batch.name}`}
              />
              <button
                className="primary"
                disabled={!routeUrl}
                onClick={() => routeUrl && window.open(routeUrl, '_blank', 'noopener')}
                title={
                  routeUrl
                    ? 'Open every stop in Google Maps, in this order'
                    : 'No delivery addresses in this batch'
                }
              >
                Open Route in Maps
              </button>
            </span>
          </div>

          <p className="subtle">
            {batch.products.length} product
            {batch.products.length === 1 ? '' : 's'} · drag a row (long-press on a
            touchscreen) or use ▲ ▼ to set the delivery order. Product details are
            read-only here.
          </p>

          {batch.products.length === 0 && (
            <p className="subtle">
              No products in this batch yet. Add some from the Products tab.
            </p>
          )}

          <div className="batch-list" ref={listRef}>
            {batch.products.map((p, idx) => {
              const addr =
                p.fulfillment === 'Pickup'
                  ? 'Pickup — no address'
                  : p.address || 'No address';
              const instr =
                (p.delivery_instructions || '').trim() || 'No instructions';
              return (
                <Fragment key={p.id}>
                  {showDropLine(idx) && <div className="drop-line" />}
                  <div
                    className={
                      'batch-row' +
                      (dragId === p.id ? ' dragging' : '') +
                      (touchDragging && dragId === p.id ? ' lifted' : '')
                    }
                    draggable={!coarsePointer}
                    onDragStart={(e) => onRowDragStart(e, p.id)}
                    onDragOver={(e) => onRowDragOver(e, idx)}
                    onDrop={onRowDrop}
                    onDragEnd={endDrag}
                    onTouchStart={(e) => onRowTouchStart(e, p.id)}
                  >
                    <span className="batch-move">
                      <button
                        disabled={busy || idx === 0}
                        onClick={() => move(idx, -1)}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        disabled={busy || idx === batch.products.length - 1}
                        onClick={() => move(idx, 1)}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </span>

                    <span className="batch-num">{idx + 1}</span>

                    <button
                      className={'made-toggle ' + (p.is_delivered ? 'on' : 'off')}
                      disabled={busy}
                      onClick={() => toggleDelivered(p)}
                    >
                      {p.is_delivered ? 'Delivered' : 'Not delivered'}
                    </button>

                    <div className="batch-cols">
                      <span className="br-addr" title={addr}>
                        <strong>{addr}</strong>
                      </span>
                      <span className="br-name" title={p.name}>
                        {p.name}
                      </span>
                      <span className="br-ticket subtle">{p.ticket_number}</span>
                      <span className="br-instr subtle" title={instr}>
                        {instr}
                      </span>
                    </div>

                    <div className="batch-actions">
                      <BatchChip
                        value={p.batch_id}
                        currentName={p.batch_name}
                        batches={batches}
                        disabled={busy}
                        onAssign={(bid) => moveToBatch(p, bid)}
                        onCreateAssign={() => createBatchFor(p)}
                        onRemove={() => removeFromBatch(p)}
                      />
                      <button
                        className="danger"
                        onClick={() => removeFromBatch(p)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {showDropLine(batch.products.length) && (
              <div className="drop-line" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
