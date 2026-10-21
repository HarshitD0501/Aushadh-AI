import React from 'react';
import { Camera, Upload, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';

export const ScanPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="scan-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="scan-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.scanTitle}
        </h2>
        <p className="card-desc">
          {t.scanSubtitle}
        </p>
      </div>

      {/* Upload & Camera Trigger Buttons */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ fontSize: '0.92rem', color: '#4b5563' }}>
          Supports printed medicine strips, boxes, and prescriptions (JPEG, PNG, WebP up to 5MB).
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: '1 1 200px' }}
            disabled
            aria-disabled="true"
          >
            <Camera size={20} />
            <span>{t.cameraButton}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ flex: '1 1 200px' }}
            disabled
            aria-disabled="true"
          >
            <Upload size={20} />
            <span>{t.uploadButton}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f3f4f6', padding: '10px 12px', borderRadius: '6px' }}>
          <AlertCircle size={18} color="#4b5563" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
            {t.ocrNotice}
          </span>
        </div>
      </div>

      {/* Honest F0 Readiness State */}
      <div className="card" style={{ borderLeft: '5px solid var(--color-border-dark)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="status-badge neutral">Phase F0 Active</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Contract: /api/v1/ocr</span>
        </div>
        <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
          {t.notConnectedTitle}
        </h3>
        <p className="card-desc" style={{ marginBottom: '14px' }}>
          Image capture, Tesseract OCR client, candidate review cards, and Gemma/Groq normalizer integration will be wired in Phase F2.
        </p>
        <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>
          Remember: When OCR is unavailable or fails, manual search remains permanently accessible.
        </p>
        <div style={{ marginTop: '12px' }}>
          <Link to="/" className="btn-secondary">
            <span>Go to Manual Search</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
