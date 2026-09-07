import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  money,
  newProductDraft,
  newDraftKey,
  draftToPayload,
  suggestedCostOf,
} from '../util';
import ProductFields from './ProductFields';

export default function NewOrder({ onCreated }) {
  const [materials, setMaterials] = useState([]);
  const [presets, setPresets] = useState([]);
  const [customer, setCustomer] = useState({
    customer_name: '',
    phone: '',
    contact_method: '',
  });
  const [products, setProducts] = useState([newProductDraft()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/materials').then(setMaterials).catch((e) => setError(e.message));
    api.get('/presets').then(setPresets).catch(() => {});
  }, []);

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

  const byId = useMemo(() => {
    const m = {};
    for (const x of materials) m[x.id] = x;
    return m;
  }, [materials]);

  const named = products.filter((p) => p.name.trim());
  const costOf = (p) =>
    p.cost === '' ? suggestedCostOf(p.materials, materials) : Number(p.cost) || 0;
  const totalCost = named.reduce((s, p) => s + costOf(p), 0);
  const totalCharge = named.reduce((s, p) => s + (Number(p.price) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!customer.customer_name.trim()) return setError('Enter the customer name.');
    if (!named.length) return setError('Add at least one product with a name.');
    setSaving(true);
    try {
      const order = await api.post('/orders', {
        ...customer,
        products: named.map((p) => draftToPayload(p, materials)),
      });
      setCustomer({ customer_name: '', phone: '', contact_method: '' });
      setProducts([newProductDraft()]);
      if (onCreated) onCreated(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>New Order</h1>
      <p className="subtle">A ticket number is assigned automatically when you submit.</p>

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

        <div className="section-label">Products in this order</div>
        {products.map((p, i) => (
          <ProductFields
            key={p._key}
            title={`Product ${i + 1}`}
            value={p}
            catalog={materials}
            presets={presets}
            onChange={(next) => setProduct(i, next)}
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
                {p.materials.length
                  ? p.materials
                      .map((m) => `${byId[m.material_id]?.name || '?'} ×${m.quantity_used}`)
                      .join(', ')
                  : 'No materials'}
                {'  ·  cost '}
                {money(costOf(p))}
              </div>
            </div>
          ))}
          <div className="summary-totals">
            <div>
              <span className="subtle">Total cost</span>
              <strong>{money(totalCost)}</strong>
            </div>
            <div>
              <span className="subtle">Total charge</span>
              <strong>{money(totalCharge)}</strong>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create order'}
        </button>
        {materials.length === 0 && (
          <p className="subtle">Tip: add your materials in the Materials tab first.</p>
        )}
      </form>
    </div>
  );
}
