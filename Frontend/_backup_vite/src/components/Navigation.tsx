import React from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Camera, MapPin, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const Navigation: React.FC = () => {
  const { t } = useLanguage();

  return (
    <nav className="primary-nav" aria-label="Main Navigation">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      >
        <Search className="nav-icon" aria-hidden="true" />
        <span>{t.navSearch}</span>
      </NavLink>

      <NavLink
        to="/scan"
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      >
        <Camera className="nav-icon" aria-hidden="true" />
        <span>{t.navScan}</span>
      </NavLink>

      <NavLink
        to="/stores"
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      >
        <MapPin className="nav-icon" aria-hidden="true" />
        <span>{t.navStores}</span>
      </NavLink>

      <NavLink
        to="/history"
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      >
        <Clock className="nav-icon" aria-hidden="true" />
        <span>{t.navHistory}</span>
      </NavLink>
    </nav>
  );
};
