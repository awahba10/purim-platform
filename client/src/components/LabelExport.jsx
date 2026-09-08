import { useState } from 'react';
import { generateLabelPdf, slotsPerSheet, labelRecipient } from '../labels';

export default function LabelExport({ kind, products, template, onClose, onExported }) {
  const [step, setStep] = useState('grid'); // grid | confirm
  const [startSlot, setStartSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const per = slotsPerSheet(template);
  const title = kind === 'gift' ? 'Gift labels' : 'Shipping labels';

  const cells = [];
  for (let r = 0; r < template.rows; r++) {
    for (let c = 0; c < template.cols; c++) {
      const idx = r * template.cols + c;
      let state = 'empty';
      if (idx < startSlot) state = 'skip';
      else if (idx < startSlot + products.length) state = 'fill';
      cells.push({ idx, r, c, state });
    }
  }
  const overflow = Math.max(0, startSlot + products.length - per);
  const startRow = Math.floor(startSlot / template.cols) + 1;
  const startCol = (startSlot % template.cols) + 1;

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      await generateLabelPdf({ kind, products, template, startSlot });
      if (onExported) await onExported(products.map((p) => p.id));
      onClose();
    } catch (e) {
      setError(e.message || 'Could not generate the PDF.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            {title} · {products.length} selected
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {step === 'grid' && (
          <>
            <p className="subtle">
              Click the first <strong>empty</strong> slot on your sheet. Slots
              before it are left blank so a partly-used sheet isn&rsquo;t wasted.
            </p>
            <div
              className="slot-grid"
              style={{
                gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
                maxWidth: template.cols * 90,
              }}
            >
              {cells.map((cell) => (
                <button
                  key={cell.idx}
                  type="button"
                  className={'slot ' + cell.state}
                  onClick={() => setStartSlot(cell.idx)}
                >
                  {cell.idx + 1}
                </button>
              ))}
            </div>
            <p className="subtle">
              Starting at row {startRow}, column {startCol}.
              {overflow > 0 &&
                ` The last ${overflow} label${
                  overflow === 1 ? '' : 's'
                } continue on a second sheet.`}
            </p>
            <div className="modal-actions">
              <button className="primary" onClick={() => setStep('confirm')}>
                Next
              </button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p className="subtle">
              About to generate <strong>{products.length}</strong> {kind} label
              {products.length === 1 ? '' : 's'}, starting at row {startRow},
              column {startCol}.
            </p>
            <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="grid">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Ticket</th>
                    <th>{kind === 'gift' ? 'To' : 'Recipient'}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id}>
                      <td>{startSlot + i + 1}</td>
                      <td>{p.ticket_number}</td>
                      <td>{labelRecipient(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={generate} disabled={busy}>
                {busy ? 'Generating…' : 'Generate PDF'}
              </button>
              <button onClick={() => setStep('grid')} disabled={busy}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
