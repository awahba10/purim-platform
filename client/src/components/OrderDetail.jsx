import { useEffect, useState } from 'react';
import { api } from '../api';
import {
  money,
  productToDraft,
  draftToPayload,
  newProductDraft,
  validateProductDraft,
  methodToForm,
  formToMethod,
  trayErrors,
  catalogWithReturned,
} from '../util';
import ProductFields from './ProductFields';
import PaymentMethodPicker from './PaymentMethodPicker';

const PAYMENT = ['Paid', 'Partially Paid', 'Not Paid'];
const PRODUCTION = ['None Made', 'Some Made', 'All Made'];
const DELIVERY = ['None Delivered', 'Some Delivered', 'All Delivered'];

// One labeled row of the status stack: label on the left (above on phones),
// chips + hint on the right.
function StatusRow({ label, children, hint }) {
  return (
    <div className="status-item">
      <div className="status-label">{label}</div>
      <div className="status-body">
        {children}
        {hint && <div className="hint">{hint}</div>}
      </div>
    </div>
  );
}

function StatusGroup({ label, options, value, computed, isAuto, busy, onPick, onAuto }) {
  return (
    <StatusRow
      label={label}
      hint={
        isAuto
          ? `Auto from products: ${value}`
          : `Manually set · calculated is ${computed}`
      }
    >
      <div className="pill-group">
        {options.map((s) => (
          <button
            key={s}
            disabled={busy}
            className={value === s ? 'pill active' : 'pill'}
            onClick={() => onPick(s)}
          >
            {s}
          </button>
        ))}
        <button
          disabled={busy || isAuto}
          className={isAuto ? 'pill active' : 'pill'}
          onClick={onAuto}
          title="Follow the value calculated from this order's products"
        >
          Auto
        </button>
      </div>
    </StatusRow>
  );
}

// Payment method: picking a preset saves right away (clicking the active chip
// clears it). "Other" needs its text typed, then Save.
function PaymentMethodRow({ stored, busy, onSave }) {
  const [form, setForm] = useState(() => methodToForm(stored));
  useEffect(() => setForm(methodToForm(stored)), [stored]);

  const change = (next) => {
    setForm(next);
    if (next.choice !== 'Other') {
      const v = formToMethod(next);
      if (v !== (stored || '')) onSave(v);
    }
  };
  const pending =
    form.choice === 'Other' && form.other.trim() !== (stored || '').trim();

  return (
    <StatusRow
      label="Payment method"
      hint={!form.choice ? 'Not set yet' : null}
    >
      <PaymentMethodPicker value={form} onChange={change} disabled={busy} />
      {pending && (
        <div className="pm-actions">
          <button
            className="primary btn-sm"
            disabled={busy || !form.other.trim()}
            onClick={() => onSave(form.other.trim())}
          >
            Save
          </button>
          <button className="btn-sm" onClick={() => setForm(methodToForm(stored))}>
            Cancel
          </button>
        </div>
      )}
    </StatusRow>
  );
}

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
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState(null);
  const [productModal, setProductModal] = useState(null); // { mode, product?, draft }

  // Materials are reloaded too so tray stock stays current after each change.
  const load = () =>
    Promise.all([api.get(`/orders/${id}`), api.get('/materials'), api.get('/presets')])
      .then(([o, m, ps]) => {
        setOrder(o);
        setOrderForm(o);
        setMaterials(m);
        setPresets(ps);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.get('/delivery-locations').then(setDeliveryLocations).catch(() => {});
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

  // Tray stock check for the add/edit product modal. When editing, the
  // product's current trays count as available again.
  const modalStockErrors = productModal
    ? trayErrors(
        [productModal.draft],
        productModal.mode === 'edit'
          ? catalogWithReturned(materials, productModal.product.materials)
          : materials
      )[productModal.draft._key] || []
    : [];

  const saveProduct = async () => {
    const { mode, product, draft } = productModal;
    if (modalStockErrors.length) return setError(modalStockErrors[0]);
    const problem = validateProductDraft(draft);
    if (problem) {
      setError(problem);
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
            <div className="status-stack">
              <StatusRow label="Payment status">
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
              </StatusRow>
              <PaymentMethodRow
                stored={order.payment_method}
                busy={busy}
                onSave={(v) => patchOrder({ payment_method: v })}
              />
              <StatusGroup
                label="Production status"
                options={PRODUCTION}
                value={order.production_status}
                computed={order.production_computed}
                isAuto={order.production_is_auto}
                busy={busy}
                onPick={(s) => patchOrder({ production_status: s })}
                onAuto={() => patchOrder({ production_auto: true })}
              />
              <StatusGroup
                label="Delivery status"
                options={DELIVERY}
                value={order.delivery_status}
                computed={order.delivery_computed}
                isAuto={order.delivery_is_auto}
                busy={busy}
                onPick={(s) => patchOrder({ delivery_status: s })}
                onAuto={() => patchOrder({ delivery_auto: true })}
              />
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
                    </span>{' '}
                    <span className={'badge ' + (p.is_delivered ? 'ok' : 'warn')}>
                      {p.is_delivered ? 'Delivered' : 'Not delivered'}
                    </span>
                    {p.batch_name && (
                      <span className="badge info"> {p.batch_name}</span>
                    )}
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
                <div className="subtle">
                  {p.fulfillment === 'Pickup'
                    ? 'Pickup'
                    : `Delivery${
                        p.delivery_location ? ` · ${p.delivery_location}` : ''
                      } · charge ${money(p.delivery_charge)}`}
                </div>
                {p.fulfillment !== 'Pickup' && p.address && (
                  <div className="subtle">Ship to: {p.address}</div>
                )}
                {p.delivery_instructions && (
                  <div className="subtle">Delivery notes: {p.delivery_instructions}</div>
                )}
                {p.recipient_name && (
                  <div className="subtle">For: {p.recipient_name}</div>
                )}
                {p.notes && <div className="subtle">Maker notes: {p.notes}</div>}
                {p.gift_message && <div className="subtle">Gift message: {p.gift_message}</div>}
                <div className="pc-actions">
                  <button disabled={busy} onClick={() => toggleMade(p)}>
                    {p.is_made ? 'Mark not made' : 'Mark made'}
                  </button>
                  <button
                    onClick={() => {
                      setError('');
                      setProductModal({ mode: 'edit', product: p, draft: productToDraft(p) });
                    }}
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
              onClick={() => {
                setError('');
                setProductModal({ mode: 'add', draft: newProductDraft() });
              }}
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
            {error && <div className="error">{error}</div>}
            <ProductFields
              value={productModal.draft}
              catalog={materials}
              presets={presets}
              deliveryLocations={deliveryLocations}
              onChange={(next) => setProductModal((pm) => ({ ...pm, draft: next }))}
              stockErrors={modalStockErrors}
            />
            <div className="modal-actions">
              <button
                className="primary"
                onClick={saveProduct}
                disabled={busy || modalStockErrors.length > 0}
              >
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
