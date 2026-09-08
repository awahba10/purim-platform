import { useEffect, useState } from 'react';
import { api } from '../api';

const NUM_FIELDS = [
  ['page_w', 'Page width (in)'],
  ['page_h', 'Page height (in)'],
  ['label_w', 'Label width (in)'],
  ['label_h', 'Label height (in)'],
  ['cols', 'Columns / sheet'],
  ['rows', 'Rows / sheet'],
  ['margin_top', 'Top margin (in)'],
  ['margin_left', 'Left margin (in)'],
  ['gap_x', 'Gap between columns (in)'],
  ['gap_y', 'Gap between rows (in)'],
];

function TemplateForm({ tpl, onSave, busy }) {
  const [draft, setDraft] = useState(tpl);
  useEffect(() => setDraft(tpl), [tpl]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="pf-section">
      <div className="pf-section-title">
        {tpl.key === 'gift' ? 'Gift Label' : 'Shipping Label'}
      </div>
      <label>
        Template name
        <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="ls-grid">
        {NUM_FIELDS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type="number"
              step={k === 'cols' || k === 'rows' ? '1' : '0.0625'}
              value={draft[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => onSave(tpl.key, draft)}
        >
          Save {tpl.key === 'gift' ? 'Gift' : 'Shipping'} template
        </button>
      </div>
    </div>
  );
}

export default function LabelSettings({ onClose, onSaved }) {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.get('/label-templates').then(setTemplates).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const save = async (key, draft) => {
    setBusy(true);
    setError('');
    try {
      const body = { name: draft.name };
      for (const [k] of NUM_FIELDS) body[k] = draft[k];
      await api.patch(`/label-templates/${key}`, body);
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Label settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="subtle">
          Dimensions of the two label sheets, in inches on a US-Letter page. Adjust
          these to match whichever Avery stock you print on.
        </p>
        {error && <div className="error">{error}</div>}
        {!templates && <p className="subtle">Loading…</p>}
        {templates && (
          <div className="form">
            {templates.map((t) => (
              <TemplateForm key={t.key} tpl={t} onSave={save} busy={busy} />
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
