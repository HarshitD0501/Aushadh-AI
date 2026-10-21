import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const Disclaimer: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage();

  return (
    <div
      role="note"
      aria-label={t.disclaimerTitle}
      className={`disclaimer-banner ${className}`}
    >
      <AlertTriangle className="disclaimer-icon" aria-hidden="true" />
      <div>
        <strong style={{ display: 'block', marginBottom: '2px' }}>{t.disclaimerTitle}:</strong>
        <span className="disclaimer-text">{t.disclaimerText}</span>
      </div>
    </div>
  );
};
