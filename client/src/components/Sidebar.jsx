import { NavLink } from 'react-router-dom';
import SeasonSwitcher from './SeasonSwitcher';
import logo from '../assets/mw-logo.png';
import Icon from './Icon';

export default function Sidebar({ nav }) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <img className="brand-logo" src={logo} alt="MW" />
        <span className="brand-name">Purim</span>
      </div>
      <ul>
        {nav.map((t) => (
          <li key={t.path}>
            <NavLink
              to={t.path}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon name={t.icon} className="ico" />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <SeasonSwitcher />
    </nav>
  );
}
