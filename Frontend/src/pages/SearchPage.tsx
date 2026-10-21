import React, { useState } from 'react';
import { Search as SearchIcon, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';

export const SearchPage: React.FC = () => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  return (
    <section aria-labelledby="search-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="search-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.searchTitle}
        </h2>
        <p className="card-desc">
          {t.searchHelpText}
        </p>
      </div>

      {/* Accessible Search Form */}
      <form onSubmit={(e) => e.preventDefault()} role="search" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label htmlFor="medicine-search-input" className="input-label">
          {t.searchAriaLabel}
        </label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="medicine-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="input-field"
            style={{ paddingLeft: '44px' }}
            autoComplete="off"
            spellCheck="false"
          />
          <SearchIcon
            size={22}
            color="#6b7280"
            aria-hidden="true"
            style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}
          />
        </div>
      </form>

      {/* Honest F0 Status & Connection Readiness Shell */}
      <div className="card" style={{ borderLeft: '5px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="status-badge neutral">Phase F0 Active</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Contract: /api/v1/search</span>
        </div>
        <h3 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="var(--color-primary)" />
          {t.notConnectedTitle}
        </h3>
        <p className="card-desc" style={{ marginBottom: '14px' }}>
          {t.notConnectedDesc} Live debounced search and verified Jan Aushadhi generic comparison will be wired in Phase F1. No simulated or fake medicine prices are displayed.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Link to="/scan" className="btn-secondary" style={{ flex: '1 1 200px' }}>
            <span>{t.navScan}</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/stores" className="btn-secondary" style={{ flex: '1 1 200px' }}>
            <span>{t.navStores}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};
