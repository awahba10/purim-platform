import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../util';

const PAYMENT_OPTIONS = ['Not Paid', 'Paid'];
const PROGRESS_OPTIONS = ['Not Made', 'Made', 'Delivered'];

function Field({ label, children, full }) {
  return (
    <div className={full ? 'f full' : 'f'}>
      <div className="subtle">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function OrderDetail({ id, onClose, onSaved, onDeleted }) {
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((o) => {
        setOrder(o);
        setForm(o);
      })
      .catch((e) => setError(e.message));
    api.get('/products').then(setProducts).catch(() => {});
  }, [id]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const patch = async (body) => {
    setBusy(true);
    setError('');
    try {
      const updated = await api.patch(`/orders/${id}`, body);
      setOrder(updated);
      setForm(updated);
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdits = async () => {
    await patch({
      name: form.name,
      address: form.address,
      phone: form.phone,
      instagram: form.instagram,
      notes: form.notes,
      gift_message: form.gift_message,
      product_id: Number(form.product_id),
    });
    setEditing(false);
  };

  const remove = async () => {
    if (
      !window.confirm(
        'Delete this order? Stock for its product will be added back.'
      )
    )
      return;
    setBusy(true);
    try {
      await api.del(`/orders/${id}`);
      if (onDeleted) onDeleted();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{order ? `Order #${order.id}` : 'Order'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        {!order && <p className="subtle">Loading…</p>}

        {order && (
          <>
            <div className="status-row">
              <div>
                <div className="subtle">Payment status</div>
                <div className="pill-group">
                  {PAYMENT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      disabled={busy}
                      className={
                        order.payment_status === s ? 'pill active' : 'pill'
                      }
                      onClick={() => patch({ payment_status: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="subtle">Progress status</div>
                <div className="pill-group">
                  {PROGRESS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      disabled={busy}
                      className={
                        order.progress_status === s ? 'pill active' : 'pill'
                      }
                      onClick={() => patch({ progress_status: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!editing ? (
              <div className="detail-grid">
                <Field label="Customer">{order.name}</Field>
                <Field label="Phone">{order.phone || '—'}</Field>
                <Field label="Instagram">{order.instagram || '—'}</Field>
                <Field label="Product">
                  {order.product_name || '—'} ({money(order.price)})
                </Field>
                <Field label="Address" full>
                  {order.address || '—'}
                </Field>
                <Field label="Notes" full>
                  {order.notes || '—'}
                </Field>
                <Field label="Gift message" full>
                  {order.gift_message || '—'}
                </Field>
                <Field label="Created" full>
                  {new Date(order.created_at).toLocaleString()}
                </Field>
              </div>
            ) : (
              <div className="form">
                <label>
                  Customer name
                  <input
                    value={form.name || ''}
                    onChange={(e) => set('name', e.target.value)}
                  />
                </label>
                <label>
                  Address
                  <textarea
                    rows={2}
                    value={form.address || ''}
                    onChange={(e) => set('address', e.target.value)}
                  />
                </label>
                <div className="row">
                  <label>
                    Phone
                    <input
                      value={form.phone || ''}
                      onChange={(e) => set('phone', e.target.value)}
                    />
                  </label>
                  <label>
                    Instagram
                    <input
                      value={form.instagram || ''}
                      onChange={(e) => set('instagram', e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Product
                  <select
                    value={form.product_id || ''}
                    onChange={(e) => set('product_id', e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({money(p.price)})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notes
                  <textarea
                    rows={2}
                    value={form.notes || ''}
                    onChange={(e) => set('notes', e.target.value)}
                  />
                </label>
                <label>
                  Gift message
                  <textarea
                    rows={3}
                    value={form.gift_message || ''}
                    onChange={(e) => set('gift_message', e.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="modal-actions">
              {!editing ? (
                <>
                  <button className="primary" onClick={() => setEditing(true)}>
                    Edit order
                  </button>
                  <button className="danger" onClick={remove} disabled={busy}>
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary"
                    onClick={saveEdits}
                    disabled={busy}
                  >
                    Save changes
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setForm(order);
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
