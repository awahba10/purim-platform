import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../util';

const EMPTY = {
  name: '',
  address: '',
  phone: '',
  instagram: '',
  product_id: '',
  notes: '',
  gift_message: '',
};

export default function NewOrder({ onCreated }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    api.get('/products').then(setProducts).catch((e) => setError(e.message));
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (!form.name.trim()) return setError('Please enter the customer name.');
    if (!form.product_id) return setError('Please choose a product.');
    setSaving(true);
    try {
      await api.post('/orders', { ...form, product_id: Number(form.product_id) });
      setForm(EMPTY);
      setDone('Order saved.');
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>New Order</h1>
      <p className="subtle">Fill out the details below to add a tray order.</p>

      <form onSubmit={submit} className="form">
        <label>
          Customer name *
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Cohen"
          />
        </label>

        <label>
          Address
          <textarea
            rows={2}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="123 Main St, Apt 4"
          />
        </label>

        <div className="row">
          <label>
            Phone number
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(555) 123-4567"
            />
          </label>
          <label>
            Instagram handle
            <input
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
              placeholder="@janecohen"
            />
          </label>
        </div>

        <label>
          Product *
          <select
            value={form.product_id}
            onChange={(e) => set('product_id', e.target.value)}
          >
            <option value="">— Select a product —</option>
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
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Leave at front door, allergic to nuts, etc."
          />
        </label>

        <label>
          Message to include in the gift
          <textarea
            rows={3}
            value={form.gift_message}
            onChange={(e) => set('gift_message', e.target.value)}
            placeholder="Chag Purim Sameach! With love, the Levy family"
          />
        </label>

        {error && <div className="error">{error}</div>}
        {done && <div className="notice">{done}</div>}

        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create order'}
        </button>

        {products.length === 0 && (
          <p className="subtle">Tip: add products in the Products tab first.</p>
        )}
      </form>
    </div>
  );
}
