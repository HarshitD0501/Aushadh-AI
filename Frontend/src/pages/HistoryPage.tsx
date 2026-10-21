import React from 'react';
import { Clock, Info, Search, Camera } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="history-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="history-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.historyTitle}
        </h2>
        <p className="card-desc">
          {t.historySubtitle}
        </p>
      </div>

      {/* Privacy Notice Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#eff6ff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
        <Info size={20} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span style={{ fontSize: '0.88rem', color: '#1e40af', lineHeight: '1.4' }}>
          {t.localOnlyWarning}
        </span>
      </div>

      {/* Honest F0 Readiness & Contract Status */}
      <div className="card" style={{ borderLeft: '5px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="status-badge neutral">Phase F0 Active</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Browser IndexedDB (Local-First)</span>
        </div>
        <h3 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="var(--color-primary)" />
          {t.notConnectedTitle}
        </h3>
        <p className="card-desc" style={{ marginBottom: '14px' }}>
          Device-local report indexing, reprint management, and aggregate potential savings calculations will be connected in Phase F5. No server login or account sync is required.
        </p>
      </div>

      {/* Honest Empty State */}
      <div className="card" style={{ textAlign: 'center', padding: '36px 16px' }}>
        <Clock size={40} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
        <h3 className="card-title" style={{ fontSize: '1.15rem' }}>
          {t.emptyHistoryTitle}
        </h3>
        <p className="card-desc" style={{ maxWidth: '420px', margin: '0 auto 18px' }}>
          {t.emptyHistoryDesc}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/" className="btn-primary">
            <Search size={18} />
            <span>Search Medicine</span>
          </Link>
          <Link to="/scan" className="btn-secondary">
            <Camera size={18} />
            <span>Scan Strip</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
