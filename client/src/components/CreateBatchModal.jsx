import { useEffect, useState } from 'react';
import { api } from '../api';

export default function CreateBatchModal({ productIds, onClose, onDone }) {
  const [mode, setMode] = useState('new'); // new | existing
  const [name, setName] = useState('');
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/batches')
      .then((list) => {
        setBatches(list);
        if (list.length) setBatchId(String(list[0].id));
        else setMode('new');
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'new') {
        if (!name.trim()) {
          setBusy(false);
          return setError('Name the new batch.');
        }
        await api.post('/batches', {
          name: name.trim(),
          product_ids: productIds,
        });
      } else {
        if (!batchId) {
          setBusy(false);
          return setError('Pick a batch.');
        }
        await api.post(`/batches/${batchId}/products`, {
          product_ids: productIds,
        });
      }
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add {productIds.length} product{productIds.length === 1 ? '' : 's'} to a batch</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="form">
          <div className="pill-group">
            <button
              type="button"
              className={mode === 'new' ? 'pill active' : 'pill'}
              onClick={() => setMode('new')}
            >
              New batch
            </button>
            <button
              type="button"
              className={mode === 'existing' ? 'pill active' : 'pill'}
              onClick={() => setMode('existing')}
              disabled={batches.length === 0}
            >
              Existing batch
            </button>
          </div>

          {mode === 'new' ? (
            <label>
              Batch name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tuesday route"
                autoFocus
              />
            </label>
          ) : (
            <label>
              Batch
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.product_count})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : mode === 'new' ? 'Create & assign' : 'Add to batch'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
