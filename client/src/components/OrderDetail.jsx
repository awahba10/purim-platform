import { useEffect, useState } from 'react';
import { api } from '../api';
import { money, productToDraft, draftToPayload, newProductDraft } from '../util';
import ProductFields from './ProductFields';

const PAYMENT = ['Not Paid', 'Paid'];
const PROGRESS = ['None Made', 'Some Made', 'All Made', 'Delivered'];

function Field({ label, children }) {
  return (
    <div className="f">
      <div className="subtle">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function OrderDetail({ id, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [presets, setPresets] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState(null);
  const [productModal, setProductModal] = useState(null); // { mode, product?, draft }

  const load = () =>
    api
      .get(`/orders/${id}`)
      .then((o) => {
        setOrder(o);
        setOrderForm(o);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.get('/materials').then(setMaterials).catch(() => {});
    api.get('/presets').then(setPresets).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleMade = async (p) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/products/${p.id}`, { is_made: !p.is_made });
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const patchOrder = async (body) => {
    setBusy(true);
    setError('');
    try {
      const updated = await api.patch(`/orders/${id}`, body);
      setOrder(updated);
      setOrderForm(updated);
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveOrderEdits = async () => {
    await patchOrder({
      customer_name: orderForm.customer_name,
      phone: orderForm.phone,
      contact_method: orderForm.contact_method,
    });
    setEditingOrder(false);
  };

  const deleteOrder = async () => {
    if (
      !window.confirm(
        'Delete this whole order? Stock for all its products goes back.'
      )
    )
      return;
    setBusy(true);
    try {
      await api.del(`/orders/${id}`);
      if (onChanged) onChanged();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const saveProduct = async () => {
    const { mode, product, draft } = productModal;
    if (!draft.name.trim()) {
      setError('The product needs a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = draftToPayload(draft, materials);
      if (mode === 'edit') await api.patch(`/products/${product.id}`, payload);
      else await api.post(`/orders/${id}/products`, payload);
      setProductModal(null);
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async (p) => {
    if (
      !window.confirm(`Remove "${p.name}" from this order? Its materials go back to stock.`)
    )
      return;
    setBusy(true);
    try {
      await api.del(`/products/${p.id}`);
      await load();
      if (onChanged) onChanged();
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
          <h2>{order ? `Order ${order.ticket_number || '#' + order.id}` : 'Order'}</h2>
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
                  {PAYMENT.map((s) => (
                    <button
                      key={s}
                      disabled={busy}
                      className={order.payment_status === s ? 'pill active' : 'pill'}
                      onClick={() => patchOrder({ payment_status: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="subtle">Progress status</div>
                <div className="pill-group">
                  {PROGRESS.map((s) => (
                    <button
                      key={s}
                      disabled={busy}
                      className={order.progress_status === s ? 'pill active' : 'pill'}
                      onClick={() => patchOrder({ progress_status: s })}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    disabled={busy || order.progress_is_auto}
                    className={order.progress_is_auto ? 'pill active' : 'pill'}
                    onClick={() => patchOrder({ progress_auto: true })}
                    title="Follow the value calculated from this order's products"
                  >
                    Auto
                  </button>
                </div>
                <div className="hint">
                  {order.progress_is_auto
                    ? `Auto from products: ${order.progress_status}`
                    : `Manually set · calculated is ${order.progress_computed}`}
                </div>
              </div>
            </div>

            {!editingOrder ? (
              <div className="detail-grid">
                <Field label="Customer">{order.customer_name}</Field>
                <Field label="Phone">{order.phone || '—'}</Field>
                <Field label="Way of contact">{order.contact_method || '—'}</Field>
                <Field label="Created">
                  {new Date(order.created_at).toLocaleString()}
                </Field>
              </div>
            ) : (
              <div className="form">
                <label>
                  Customer name
                  <input
                    value={orderForm.customer_name || ''}
                    onChange={(e) =>
                      setOrderForm((f) => ({ ...f, customer_name: e.target.value }))
                    }
                  />
                </label>
                <div className="row">
                  <label>
                    Phone
                    <input
                      value={orderForm.phone || ''}
                      onChange={(e) =>
                        setOrderForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Way of contact
                    <input
                      value={orderForm.contact_method || ''}
                      onChange={(e) =>
                        setOrderForm((f) => ({ ...f, contact_method: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="primary" onClick={saveOrderEdits} disabled={busy}>
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingOrder(false);
                      setOrderForm(order);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="section-label" style={{ marginTop: 18 }}>
              Products ({order.products.length})
            </div>
            {order.products.map((p) => (
              <div className="product-card" key={p.id}>
                <div className="pc-top">
                  <strong>
                    {p.name}{' '}
                    <span className={'badge ' + (p.is_made ? 'ok' : 'warn')}>
                      {p.is_made ? 'Made' : 'Not made'}
                    </span>
                  </strong>
                  <span>{money(p.price)}</span>
                </div>
                <div className="subtle">
                  {p.materials.length
                    ? p.materials
                        .map((m) => `${m.material_name} ×${m.quantity_used}`)
                        .join(', ')
                    : 'No materials'}
                  {'  ·  cost '}
                  {money(p.cost)}
                  {'  ·  profit '}
                  {money(p.profit)}
                </div>
                {p.address && <div className="subtle">Ship to: {p.address}</div>}
                {p.notes && <div className="subtle">Notes: {p.notes}</div>}
                {p.gift_message && <div className="subtle">Message: {p.gift_message}</div>}
                <div className="pc-actions">
                  <button disabled={busy} onClick={() => toggleMade(p)}>
                    {p.is_made ? 'Mark not made' : 'Mark made'}
                  </button>
                  <button
                    onClick={() =>
                      setProductModal({ mode: 'edit', product: p, draft: productToDraft(p) })
                    }
                  >
                    Edit
                  </button>
                  <button className="danger" onClick={() => deleteProduct(p)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="add-product"
              onClick={() => setProductModal({ mode: 'add', draft: newProductDraft() })}
            >
              + Add product to this order
            </button>

            <div className="summary-totals" style={{ marginTop: 16 }}>
              <div>
                <span className="subtle">Total cost</span>
                <strong>{money(order.total_cost)}</strong>
              </div>
              <div>
                <span className="subtle">Total charge</span>
                <strong>{money(order.total_price)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              {!editingOrder && (
                <button className="primary" onClick={() => setEditingOrder(true)}>
                  Edit customer info
                </button>
              )}
              <button className="danger" onClick={deleteOrder} disabled={busy}>
                Delete order
              </button>
            </div>
          </>
        )}
      </div>

      {productModal && (
        <div
          className="modal-backdrop layer2"
          onClick={(e) => {
            e.stopPropagation();
            setProductModal(null);
          }}
        >
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{productModal.mode === 'edit' ? 'Edit product' : 'Add product'}</h2>
              <button
                className="icon-btn"
                onClick={() => setProductModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ProductFields
              value={productModal.draft}
              catalog={materials}
              presets={presets}
              onChange={(next) => setProductModal((pm) => ({ ...pm, draft: next }))}
            />
            <div className="modal-actions">
              <button className="primary" onClick={saveProduct} disabled={busy}>
                Save product
              </button>
              <button onClick={() => setProductModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
