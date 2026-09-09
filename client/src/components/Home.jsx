import { NavLink } from 'react-router-dom';
import { NAV } from '../nav';

export default function Home() {
  const links = NAV.filter((t) => t.path !== '/home');
  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Home</h1>
      </div>
      <p className="subtle">Jump to any part of the platform.</p>

      <div className="hub-grid">
        {links.map((t) => (
          <NavLink key={t.path} to={t.path} className="hub-card">
            <span className="hub-ico">{t.icon}</span>
            <span className="hub-label">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
