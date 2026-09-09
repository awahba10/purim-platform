import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

// Group every product row (across all orders) by product name, with tallies.
function buildGroups(products) {
  const map = new Map();
  for (const p of products) {
    const key = (p.name || '').trim() || '—';
    let g = map.get(key);
    if (!g) {
      g = {
        name: key,
        items: [],
        total: 0,
        made: 0,
        delivered: 0,
        gift: 0,
        ship: 0,
      };
      map.set(key, g);
    }
    g.items.push(p);
    g.total += 1;
    if (p.is_made) g.made += 1;
    if (p.is_delivered) g.delivered += 1;
    if (p.gift_label_printed) g.gift += 1;
    if (p.shipping_label_printed) g.ship += 1;
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function matLine(p) {
  if (!p.materials || !p.materials.length) return 'No materials';
  return p.materials
    .map((m) => `${m.material_name} ×${m.quantity_used}`)
    .join(', ');
}

export default function Production() {
  const navigate = useNavigate();
  const { name } = useParams(); // react-router already URL-decodes this
  const selectedName = name || null;

  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () =>
    api.get('/products').then(setProducts).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(
    () => (products ? buildGroups(products) : []),
    [products]
  );
  const current = useMemo(
    () => groups.find((g) => g.name === selectedName) || null,
    [groups, selectedName]
  );

  const toggleMade = async (p) => {
    setBusyId(p.id);
    setError('');
    try {
      await api.patch(`/products/${p.id}`, { is_made: !p.is_made });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (error && products === null) {
    return (
      <div className="panel">
        <h1>Production</h1>
        <div className="error">{error}</div>
      </div>
    );
  }
  if (products === null) {
    return (
      <div className="panel">
        <h1>Production</h1>
        <p className="subtle">Loading…</p>
      </div>
    );
  }

  // ---- Detail view: one product name, every ticket for it ----
  if (selectedName) {
    return (
      <div className="panel">
        <button className="btn-sm" onClick={() => navigate('/production')}>
          ← All products
        </button>

        {error && <div className="error">{error}</div>}

        {!current ? (
          <p className="subtle">
            No products named “{selectedName}”.
          </p>
        ) : (
          <>
            <div className="panel-head">
              <h1>{current.name}</h1>
            </div>
            <p className="subtle">
              {current.total} ticket{current.total === 1 ? '' : 's'} ·{' '}
              {current.made}/{current.total} made · {current.delivered}/
              {current.total} delivered · {current.gift}/{current.total} gift
              labels · {current.ship}/{current.total} shipping labels
            </p>

            {current.items.map((p) => {
              const long = (p.materials || []).length > 3;
              const open = openId === p.id;
              return (
                <div className="product-card" key={p.id}>
                  <div className="pc-top">
                    <strong>
                      {p.ticket_number || '#' + p.order_id}{' '}
                      <span
                        className={'badge ' + (p.is_made ? 'ok' : 'warn')}
                      >
                        {p.is_made ? 'Made' : 'Not made'}
                      </span>{' '}
                      <span
                        className={
                          'badge ' + (p.is_delivered ? 'ok' : 'warn')
                        }
                      >
                        {p.is_delivered ? 'Delivered' : 'Not delivered'}
                      </span>
                    </strong>
                    <button
                      className={'made-toggle ' + (p.is_made ? 'on' : 'off')}
                      disabled={busyId === p.id}
                      onClick={() => toggleMade(p)}
                    >
                      {p.is_made ? 'Mark not made' : 'Mark made'}
                    </button>
                  </div>

                  <div className="subtle">
                    {p.customer_name}
                    {p.recipient_name ? ` · for ${p.recipient_name}` : ''}
                  </div>

                  <div className="subtle">
                    <strong>Materials: </strong>
                    {long && !open ? (
                      <>
                        {(p.materials || [])
                          .slice(0, 3)
                          .map((m) => `${m.material_name} ×${m.quantity_used}`)
                          .join(', ')}
                        {' … '}
                        <button
                          className="linkbtn"
                          onClick={() => setOpenId(p.id)}
                        >
                          show all {p.materials.length}
                        </button>
                      </>
                    ) : (
                      <>
                        {matLine(p)}
                        {long && (
                          <>
                            {'  '}
                            <button
                              className="linkbtn"
                              onClick={() => setOpenId(null)}
                            >
                              show less
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ---- Overview: one card per product name ----
  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Production</h1>
        <button onClick={load}>Refresh</button>
      </div>
      <p className="subtle">
        Every product name across all orders, with how many are made, delivered,
        and labelled. Click one to see its tickets and toggle Made.
      </p>
      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Product</th>
              <th>Total</th>
              <th>Not Made</th>
              <th>Made</th>
              <th>Delivered</th>
              <th>Gift Label</th>
              <th>Shipping Label</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.name}
                onClick={() =>
                  navigate(`/production/${encodeURIComponent(g.name)}`)
                }
              >
                <td>{g.name}</td>
                <td>{g.total}</td>
                <td>{g.total - g.made}</td>
                <td>{g.made}</td>
                <td>{g.delivered}</td>
                <td>
                  {g.gift} / {g.total}
                </td>
                <td>
                  {g.ship} / {g.total}
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="subtle">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
