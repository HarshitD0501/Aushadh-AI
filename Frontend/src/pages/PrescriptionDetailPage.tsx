import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, PhoneCall, Calendar, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const PrescriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();

  return (
    <section aria-labelledby="prescription-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h2 id="prescription-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
            {t.prescriptionTitle}
          </h2>
          <span className="status-badge neutral">Report #{id?.slice(0, 8) || 'unknown'}</span>
        </div>
        <p className="card-desc">
          {t.prescriptionSubtitle}
        </p>
      </div>

      {/* Honest F0 Readiness & Contract Status */}
      <div className="card" style={{ borderLeft: '5px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="status-badge neutral">Phase F0 Active</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Contracts: /compare, /reminders, /calls</span>
        </div>
        <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
          {t.notConnectedTitle}
        </h3>
        <p className="card-desc" style={{ marginBottom: '12px' }}>
          Report ID: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{id}</code>.
          Local IndexedDB report storage, multi-item basket calculations, and printable counter slips will be wired in Phase F3. WhatsApp schedules and immediate outbound checkup calls will connect in Phase F6.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#ecfdf5', padding: '10px 12px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
          <AlertCircle size={18} color="#065f46" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '0.85rem', color: '#065f46' }}>
            {t.estimatedSavingNotice}
          </span>
        </div>
      </div>

      {/* Planned Action Controls Shell */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
          Planned Actions &amp; Controls
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled
            aria-disabled="true"
          >
            <Printer size={18} />
            <span>{t.printSlip}</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled
            aria-disabled="true"
          >
            <Calendar size={18} />
            <span>Set Reminder</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled
            aria-disabled="true"
          >
            <PhoneCall size={18} />
            <span>{t.callPatient}</span>
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
          All calls and reminders target the backend configured test phone number only. No personal phone number is requested or stored.
        </p>
      </div>

      <div>
        <Link to="/history" className="btn-secondary">
          <span>&larr; Back to Saved History</span>
        </Link>
      </div>
    </section>
  );
};
