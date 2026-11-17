import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  money,
  newProductDraft,
  newDraftKey,
  draftToPayload,
  suggestedCostOf,
  validateProductDraft,
  formToMethod,
  validateMethodForm,
  trayErrors,
  softStockWarnings,
  splitTrays,
} from '../util';
import ProductFields from './ProductFields';
import PaymentMethodPicker from './PaymentMethodPicker';
import MaterialsList from './MaterialsList';
import { useSeason } from '../season';

export default function NewOrder() {
  const navigate = useNavigate();
  const { current, active, readOnly, unlocked } = useSeason();
  const [materials, setMaterials] = useState([]);
  const [presets, setPresets] = useState([]);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [customer, setCustomer] = useState({
    customer_name: '',
    phone: '',
    contact_method: '',
  });
  const [payMethod, setPayMethod] = useState({ choice: '', other: '' });
  const [products, setProducts] = useState([newProductDraft()]);
  const [brands, setBrands] = useState([]);
  // Product cards folded down to their one-line summary (by draft _key).
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/materials').then(setMaterials).catch((e) => setError(e.message));
    api.get('/presets').then(setPresets).catch(() => {});
    api.get('/delivery-locations').then(setDeliveryLocations).catch(() => {});
    api.get('/brands').then(setBrands).catch(() => {});
  }, []);

  const toggleCollapse = (key) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const allCollapsed = products.length > 0 && products.every((p) => collapsed.has(p._key));
  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(products.map((p) => p._key)));

  const setC = (k, v) => setCustomer((c) => ({ ...c, [k]: v }));
  const setProduct = (i, next) =>
    setProducts((ps) => ps.map((p, idx) => (idx === i ? next : p)));
  const addProduct = () => setProducts((ps) => [...ps, newProductDraft()]);
  const removeProduct = (i) => setProducts((ps) => ps.filter((_, idx) => idx !== i));
  const duplicateProduct = (i) =>
    setProducts((ps) => {
      const copy = {
        ...ps[i],
        _key: newDraftKey(),
        materials: ps[i].materials.map((m) => ({ ...m })),
      };
      return [...ps.slice(0, i + 1), copy, ...ps.slice(i + 1)];
    });


  const stockErrors = useMemo(
    () => trayErrors(products, materials),
    [products, materials]
  );
  const hasStockErrors = Object.keys(stockErrors).length > 0;
  const stockWarnings = useMemo(
    () => softStockWarnings(products, materials),
    [products, materials]
  );

  // A product needs attention if its trays are short, or (once it has a
  // name) something required is missing. Shown as ⚠ on the collapsed line.
  const problemOf = (p) =>
    (stockErrors[p._key] && stockErrors[p._key].length > 0) ||
    (p.name.trim() && !!validateProductDraft(p));

  // The collapsed one-line summary for a product card.
  const summaryFor = (p) => {
    const { trays } = splitTrays(p.materials, materials);
    const tray = trays[0] && materials.find((m) => m.id === trays[0].material_id);
    const brand = p.brand_id && brands.find((b) => b.id === p.brand_id);
    const delivery = p.fulfillment === 'Pickup' ? 0 : Number(p.delivery_charge) || 0;
    return (
      <>
        <span className="ps-name">{p.name.trim() || 'Untitled'}</span>
        {tray && (
          <span className="ps-tray">
            {tray.name} ×{trays[0].quantity_used}
          </span>
        )}
        {brand && <span className="ps-brand">{brand.name}</span>}
        <span className="ps-ful">
          {p.fulfillment === 'Pickup'
            ? 'Pickup'
            : `Delivery → ${p.delivery_location.trim() || '?'}`}
        </span>
        {p.recipientOn && p.recipient_name.trim() && (
          <span className="ps-for">For: {p.recipient_name.trim()}</span>
        )}
        <span className="ps-price">
          {money(Number(p.price) || 0)}
          {delivery > 0 && <span className="subtle"> (+{money(delivery)})</span>}
        </span>
      </>
    );
  };

  // Open any collapsed card that has a problem, so it can't hide.
  const expandProblems = () =>
    setCollapsed((s) => {
      const n = new Set(s);
      for (const p of products) if (problemOf(p)) n.delete(p._key);
      return n;
    });

  const named = products.filter((p) => p.name.trim());
  const costOf = (p) =>
    p.cost === '' ? suggestedCostOf(p.materials, materials) : Number(p.cost) || 0;
  const deliveryOf = (p) =>
    p.fulfillment === 'Pickup' ? 0 : Number(p.delivery_charge) || 0;
  const totalCost = named.reduce((s, p) => s + costOf(p), 0);
  const totalCharge = named.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const totalDelivery = named.reduce((s, p) => s + deliveryOf(p), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!customer.customer_name.trim()) return setError('Enter the customer name.');
    const methodProblem = validateMethodForm(payMethod);
    if (methodProblem) return setError(methodProblem);
    if (!named.length) return setError('Add at least one product with a name.');
    if (hasStockErrors) {
      expandProblems();
      return setError('Not enough trays for this order — fix the products marked in red.');
    }
    for (const p of named) {
      const problem = validateProductDraft(p);
      if (problem) {
        expandProblems();
        return setError(`"${p.name.trim()}": ${problem}`);
      }
    }
    setSaving(true);
    try {
      const order = await api.post('/orders', {
        ...customer,
        payment_method: formToMethod(payMethod),
        products: named.map((p) => draftToPayload(p, materials)),
      });
      setCustomer({ customer_name: '', phone: '', contact_method: '' });
      setPayMethod({ choice: '', other: '' });
      setProducts([newProductDraft()]);
      setCollapsed(new Set());
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) {
    return (
      <div className="panel">
        <h1>New Order</h1>
        <div className="locked-msg">
          <p>
            <strong>{current.name}</strong> is a closed season, so New Order is turned
            off while you're viewing it.
          </p>
          <p className="subtle">
            To add an order to it anyway, use <strong>Unlock to edit</strong> in the
            banner above.
            {active && active.id !== current.id
              ? ` To take new orders, switch to the active season (${active.name}) with the season menu at the top.`
              : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>New Order</h1>
      <p className="subtle">
        A ticket number is assigned automatically when you submit. This order goes
        into <strong>{current.name}</strong>
        {unlocked ? ' (a closed season you unlocked)' : ''}.
      </p>

      <form onSubmit={submit} className="form form-wide">
        <div className="section-label">Customer</div>
        <label>
          Customer name *
          <input
            value={customer.customer_name}
            onChange={(e) => setC('customer_name', e.target.value)}
            placeholder="Jane Cohen"
          />
        </label>
        <div className="row">
          <label>
            Phone number
            <input
              value={customer.phone}
              onChange={(e) => setC('phone', e.target.value)}
              placeholder="(555) 123-4567"
            />
          </label>
          <label>
            Way of contact
            <input
              value={customer.contact_method}
              onChange={(e) => setC('contact_method', e.target.value)}
              placeholder="Text, WhatsApp, @handle, email…"
            />
          </label>
        </div>
        <div>
          <div className="fld-label">
            Payment method <span className="subtle">(optional — can be added later)</span>
          </div>
          <PaymentMethodPicker value={payMethod} onChange={setPayMethod} />
        </div>

        <div className="section-label">Products in this order</div>
        <div className="products-bar">
          <span>
            {products.length} product{products.length === 1 ? '' : 's'}
          </span>
          <button type="button" className="btn-sm" onClick={toggleAll}>
            {allCollapsed ? '▾ Expand all' : '▸ Collapse all'}
          </button>
        </div>
        {products.map((p, i) => (
          <ProductFields
            key={p._key}
            title={`Product ${i + 1}`}
            value={p}
            catalog={materials}
            presets={presets}
            brands={brands}
            deliveryLocations={deliveryLocations}
            onChange={(next) => setProduct(i, next)}
            stockErrors={stockErrors[p._key]}
            stockWarnings={stockWarnings[p._key]}
            collapsed={collapsed.has(p._key)}
            onToggleCollapse={() => toggleCollapse(p._key)}
            summary={summaryFor(p)}
            hasProblem={problemOf(p)}
            onDuplicate={() => duplicateProduct(i)}
            onRemove={products.length > 1 ? () => removeProduct(i) : null}
          />
        ))}
        <button type="button" className="add-product" onClick={addProduct}>
          + Add another product
        </button>

        <div className="summary-box">
          <div className="section-label">Order summary</div>
          {named.length === 0 && <p className="subtle">No products added yet.</p>}
          {named.map((p, i) => (
            <div className="summary-product" key={i}>
              <div className="sp-top">
                <strong>{p.name.trim()}</strong>
                <span>{money(Number(p.price) || 0)}</span>
              </div>
              <div className="subtle">
                <MaterialsList materials={p.materials} catalog={materials} />
                {'cost '}
                {money(costOf(p))}
                {'  ·  '}
                {p.fulfillment === 'Pickup'
                  ? 'Pickup'
                  : `Delivery${p.delivery_location ? ` to ${p.delivery_location}` : ''} (+${money(
                      deliveryOf(p)
                    )})`}
              </div>
            </div>
          ))}
          <div className="summary-totals">
            <div>
              <span className="subtle">Total cost</span>
              <strong>{money(totalCost)}</strong>
            </div>
            <div>
              <span className="subtle">Product charge</span>
              <strong>{money(totalCharge)}</strong>
            </div>
            <div>
              <span className="subtle">Delivery charge</span>
              <strong>{money(totalDelivery)}</strong>
            </div>
            <div>
              <span className="subtle">Grand total</span>
              <strong>{money(totalCharge + totalDelivery)}</strong>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {hasStockErrors && (
          <div className="stock-error">
            Not enough trays for this order — reduce the quantities marked in red
            to submit.
          </div>
        )}
        <button className="primary" disabled={saving || hasStockErrors}>
          {saving ? 'Saving…' : 'Create order'}
        </button>
        {materials.length === 0 && (
          <p className="subtle">Tip: add your materials in the Inventory tab first.</p>
        )}
      </form>
    </div>
  );
}
