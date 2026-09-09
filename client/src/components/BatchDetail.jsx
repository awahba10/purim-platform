import { useEffect, useState } from 'react';
import { api } from '../api';
import { buildMapsRouteUrl } from '../util';

export default function BatchDetail({ id, onBack, onChanged }) {
  const [batch, setBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [dragId, setDragId] = useState(null);

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

  const onDrop = (targetId) => {
    if (dragId == null || dragId === targetId) return;
    const ids = batch.products.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragId(null);
    persistOrder(ids);
  };

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
      await api.patch(`/products/${p.id}`, {
        batch_id: targetId === '' ? null : Number(targetId),
      });
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

  return (
    <div className="panel">
      <button className="linkbtn" onClick={onBack}>
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
                <button className="linkbtn" onClick={() => setRenaming(true)}>
                  rename
                </button>
              </h1>
            )}
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
          </div>

          <p className="subtle">
            {batch.products.length} product{batch.products.length === 1 ? '' : 's'} ·
            drag a row or use ▲ ▼ to set the delivery order. Product details are
            read-only here.
          </p>

          {batch.products.length === 0 && (
            <p className="subtle">
              No products in this batch yet. Add some from the Products tab.
            </p>
          )}

          <ol className="batch-list">
            {batch.products.map((p, idx) => (
              <li
                key={p.id}
                className={'batch-row' + (dragId === p.id ? ' dragging' : '')}
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(p.id)}
                onDragEnd={() => setDragId(null)}
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
                <div className="batch-body">
                  <div className="batch-title">
                    <strong>{p.name}</strong>
                    <span className="subtle"> · {p.ticket_number}</span>
                  </div>
                  <div className="subtle">
                    {p.fulfillment === 'Pickup'
                      ? 'Pickup — no address'
                      : p.address || 'No address'}
                  </div>
                  <div className="subtle">
                    {p.customer_name}
                    {p.materials.length
                      ? ' · ' +
                        p.materials
                          .map((m) => `${m.material_name}×${m.quantity_used}`)
                          .join(', ')
                      : ''}
                  </div>
                </div>
                <div className="batch-actions">
                  <button
                    className={
                      'made-toggle ' + (p.is_delivered ? 'on' : 'off')
                    }
                    disabled={busy}
                    onClick={() => toggleDelivered(p)}
                  >
                    {p.is_delivered ? 'Delivered' : 'Not delivered'}
                  </button>
                  <select
                    value={id}
                    disabled={busy}
                    onChange={(e) => moveToBatch(p, e.target.value)}
                    title="Move to another batch"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id === Number(id) ? `This batch` : `→ ${b.name}`}
                      </option>
                    ))}
                    <option value="">→ Remove from batch</option>
                  </select>
                  <button className="danger" onClick={() => removeFromBatch(p)}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
