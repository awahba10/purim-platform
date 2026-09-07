import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../util';

function ProductForm({ materials, product, onClose, onSaved }) {
  const [name, setName] = useState(product?.name || '');
  const [quantity, setQuantity] = useState(product?.quantity ?? 0);
  const [cost, setCost] = useState(product?.cost ?? '');
  const [price, setPrice] = useState(product?.price ?? '');
  const [links, setLinks] = useState(() => {
    const map = {};
    (product?.materials || []).forEach((m) => {
      map[m.material_id] = m.quantity_used;
    });
    return map;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id) =>
    setLinks((current) => {
      const next = { ...current };
      if (id in next) delete next[id];
      else next[id] = 1;
      return next;
    });

  const setLinkQty = (id, value) =>
    setLinks((current) => ({
      ...current,
      [id]: Math.max(1, Number(value) || 1),
    }));

  const save = async () => {
    if (!name.trim()) return setError('Please give the product a name.');
    setBusy(true);
    setError('');
    const body = {
      name: name.trim(),
      quantity: Number(quantity) || 0,
      cost: Number(cost) || 0,
      price: Number(price) || 0,
      materials: Object.entries(links).map(([material_id, quantity_used]) => ({
        material_id: Number(material_id),
        quantity_used,
      })),
    };
    try {
      if (product) await api.patch(`/products/${product.id}`, body);
      else await api.post('/products', body);
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{product ? 'Edit product' : 'New product'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="form">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="row">
            <label>
              In stock
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label>
              Cost to make
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </label>
            <label>
              Sell price
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="subtle" style={{ marginBottom: 6 }}>
              Materials used (check the ones this product needs)
            </div>
            {materials.length === 0 && (
              <div className="subtle">
                Add materials first in the Materials tab.
              </div>
            )}
            <div className="check-list">
              {materials.map((m) => (
                <div key={m.id} className="check-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={m.id in links}
                      onChange={() => toggle(m.id)}
                    />
                    {m.name}
                  </label>
                  {m.id in links && (
                    <input
                      type="number"
                      min="1"
                      value={links[m.id]}
                      onChange={(e) => setLinkQty(m.id, e.target.value)}
                      style={{ width: '70px' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <div className="error">{error}</div>}
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () =>
    Promise.all([api.get('/products'), api.get('/materials')])
      .then(([p, m]) => {
        setProducts(p);
        setMaterials(m);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const afterSave = () => {
    setShowForm(false);
    setEditing(null);
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.del(`/products/${p.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="panel">
      <h1>Products</h1>
      <p className="subtle">
        Each product lists what it costs to make, what it sells for, and which
        materials it uses.
      </p>

      <button
        className="primary"
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
      >
        + Add product
      </button>

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>In stock</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Profit</th>
              <th>Materials used</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className={p.quantity < 0 ? 'neg' : ''}>{p.quantity}</td>
                <td>{money(p.cost)}</td>
                <td>{money(p.price)}</td>
                <td>{money(p.price - p.cost)}</td>
                <td className="subtle">
                  {p.materials.length
                    ? p.materials
                        .map((m) => `${m.material_name} ×${m.quantity_used}`)
                        .join(', ')
                    : '—'}
                </td>
                <td className="right">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                  <button className="danger" onClick={() => remove(p)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="subtle">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          materials={materials}
          product={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}
