import { useEffect, useState } from 'react';
import { api } from '../api';
import BatchDetail from './BatchDetail';

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    api.get('/batches').then(setBatches).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const name = window.prompt('Name for the new batch (e.g. "Tuesday route"):');
    if (!name || !name.trim()) return;
    try {
      const b = await api.post('/batches', { name: name.trim() });
      await load();
      setOpenId(b.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (b) => {
    if (
      !window.confirm(
        `Delete batch "${b.name}"? Its products stay, but lose their batch assignment.`
      )
    )
      return;
    try {
      await api.del(`/batches/${b.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (openId != null) {
    return (
      <BatchDetail
        id={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
        onChanged={load}
      />
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Delivery Batches</h1>
        <button className="primary" onClick={create}>
          + New batch
        </button>
      </div>
      <p className="subtle">
        Group products into a delivery run, set their order, and open the whole
        route in Google Maps. Add products to a batch from the Products tab.
      </p>
      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Products</th>
              <th>Delivered</th>
              <th>Created</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} onClick={() => setOpenId(b.id)}>
                <td>{b.name}</td>
                <td>{b.product_count}</td>
                <td>
                  {b.delivered_count} / {b.product_count}
                </td>
                <td>{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="right">
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(b);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={5} className="subtle">
                  No batches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
