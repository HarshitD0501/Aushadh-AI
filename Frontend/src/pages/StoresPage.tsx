import React from 'react';
import { MapPin, Navigation as NavIcon, Compass } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const StoresPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="stores-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="stores-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.storesTitle}
        </h2>
        <p className="card-desc">
          {t.storesSubtitle}
        </p>
      </div>

      {/* City & Geolocation Selector Shell */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label htmlFor="city-select-input" className="input-label">
            {t.selectCity}
          </label>
          <select
            id="city-select-input"
            className="input-field"
            disabled
            aria-disabled="true"
            defaultValue=""
          >
            <option value="" disabled>Select a city (loading in Phase F4)…</option>
          </select>
        </div>

        <button
          type="button"
          className="btn-secondary"
          disabled
          aria-disabled="true"
          style={{ width: '100%' }}
        >
          <Compass size={18} />
          <span>{t.useLocation}</span>
        </button>
      </div>

      {/* Honest F0 Readiness & Contract Status */}
      <div className="card" style={{ borderLeft: '5px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="status-badge neutral">Phase F0 Active</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Contracts: /cities, /stores, /routes</span>
        </div>
        <h3 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} color="var(--color-primary)" />
          {t.notConnectedTitle}
        </h3>
        <p className="card-desc" style={{ marginBottom: '14px' }}>
          Official PMBJP Kendra locator, separate classification from generic commercial pharmacies, lazy-loaded Leaflet maps, and driving route geometry will be connected in Phase F4.
        </p>
        <p style={{ fontSize: '0.88rem', color: '#4b5563', lineHeight: '1.4' }}>
          <strong>Performance guarantee:</strong> Maps and spatial libraries are not bundled in initial search bundle to ensure fast loading on 360px phones with weak network connectivity.
        </p>
      </div>

      {/* Honest Empty Stores List Shell */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
        <NavIcon size={36} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '6px' }}>
          Store Locator Ready
        </h4>
        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          Awaiting backend Kendra repository connection.
        </p>
      </div>
    </section>
  );
};
