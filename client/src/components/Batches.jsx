import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import BatchDetail from './BatchDetail';
import ShareButton from './ShareButton';

export default function Batches() {
  const navigate = useNavigate();
  const { id } = useParams();
  const batchId = /^\d+$/.test(id || '') ? Number(id) : null;
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');

  const load = () =>
    api.get('/batches').then(setBatches).catch((e) => setError(e.message));

  // Refresh the list whenever we're on the list route (including returning to it
  // from a batch detail page, since this component stays mounted for both).
  useEffect(() => {
    if (batchId == null) load();
  }, [batchId]);

  const create = async () => {
    const name = window.prompt('Name for the new batch (e.g. "Tuesday route"):');
    if (!name || !name.trim()) return;
    try {
      const b = await api.post('/batches', { name: name.trim() });
      navigate(`/batches/${b.id}`);
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

  if (batchId != null) {
    return (
      <BatchDetail
        id={batchId}
        onBack={() => navigate('/batches')}
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
              <tr key={b.id} onClick={() => navigate(`/batches/${b.id}`)}>
                <td>{b.name}</td>
                <td>{b.product_count}</td>
                <td>
                  {b.delivered_count} / {b.product_count}
                </td>
                <td>{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="right" onClick={(e) => e.stopPropagation()}>
                  <ShareButton
                    path={`/batches/${b.id}`}
                    title={`Delivery batch: ${b.name}`}
                  />
                  <button className="danger" onClick={() => remove(b)}>
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
