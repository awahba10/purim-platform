const ICONS = {
  'New Order': '📝',
  'All Orders': '📋',
  Materials: '📦',
  Products: '🎁',
  Financials: '💰',
};

export default function Sidebar({ tabs, active, onSelect }) {
  return (
    <nav className="sidebar">
      <div className="brand">🌸 Purim Platform</div>
      <ul>
        {tabs.map((t) => (
          <li key={t}>
            <button
              className={t === active ? 'active' : ''}
              onClick={() => onSelect(t)}
            >
              <span className="ico">{ICONS[t]}</span>
              {t}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
