import { money } from '../util';

const METRICS = [
  { key: 'count', label: 'Count' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
];

// Horizontal bar graph, single series, bars left -> right. `rows` is
// [{ label, count, revenue, profit }]. Metric toggle lives in the header.
export default function BarGraph({ title, rows, metric, onMetric }) {
  const key = METRICS.some((m) => m.key === metric) ? metric : 'count';
  const sorted = [...rows].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const max = Math.max(1, ...sorted.map((r) => Math.abs(Number(r[key]) || 0)));
  const fmt = key === 'count' ? (v) => String(v) : (v) => money(v);

  return (
    <div className="bargraph">
      <div className="bg-head">
        <h3>{title}</h3>
        <div className="pill-group">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={key === m.key ? 'pill active' : 'pill'}
              onClick={() => onMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
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
