import { money } from '../util';

const METRICS = [
  { key: 'count', label: 'Count' },
  { key: 'revenue', label: 'Revenue', money: true },
  { key: 'profit', label: 'Profit', money: true },
];

// Horizontal bar graph, single series, bars left -> right. `rows` is
// [{ label, ...numeric fields }]. With the default metrics a Count / Revenue /
// Profit toggle lives in the header; pass a single-item `metrics` to show one
// fixed measure (no toggle). `keepOrder` keeps the rows' given order (e.g. by
// price or by date) instead of sorting largest first.
export default function BarGraph({
  title,
  rows,
  metric,
  onMetric,
  metrics = METRICS,
  keepOrder = false,
}) {
  const m = metrics.find((x) => x.key === metric) || metrics[0];
  const key = m.key;
  const sorted = keepOrder
    ? rows
    : [...rows].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const max = Math.max(1, ...sorted.map((r) => Math.abs(Number(r[key]) || 0)));
  const fmt = m.money ? (v) => money(v) : (v) => String(v);

  return (
    <div className="bargraph">
      <div className="bg-head">
        <h3>{title}</h3>
        {metrics.length > 1 && (
          <div className="pill-group">
            {metrics.map((x) => (
              <button
                key={x.key}
                type="button"
                className={key === x.key ? 'pill active' : 'pill'}
                onClick={() => onMetric(x.key)}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="subtle">No data for the current filters.</p>
      ) : (
        <div className="bg-rows">
          {sorted.map((r) => {
            const v = Number(r[key]) || 0;
            const pct = (Math.abs(v) / max) * 100;
            return (
              <div className="bg-row" key={r.label} title={`${r.label}: ${fmt(v)}`}>
                <span className="bg-label">{r.label}</span>
                <span className="bg-track">
                  <span className="bg-fill" style={{ width: pct + '%' }} />
                </span>
                <span className="bg-val">{fmt(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
