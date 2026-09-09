import { NavLink } from 'react-router-dom';

export default function Sidebar({ nav }) {
  return (
    <nav className="sidebar">
      <div className="brand">🌸 Purim Platform</div>
      <ul>
        {nav.map((t) => (
          <li key={t.path}>
            <NavLink
              to={t.path}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="ico">{t.icon}</span>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
