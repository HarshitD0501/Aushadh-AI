import React from 'react';
import { Link } from 'react-router-dom';
import { Pill } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  return (
    <header className="app-header" role="banner">
      <div className="header-top">
        <Link to="/" className="brand-wrapper" aria-label={`${t.appName} - Home`}>
          <div className="brand-logo" aria-hidden="true">
            <Pill size={22} color="#ffffff" />
          </div>
          <div>
            <h1 className="brand-name">{t.appName}</h1>
            <p className="brand-tagline">{t.appTagline}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={toggleLanguage}
          className="lang-switch-btn"
          aria-label={`Change language to ${language === 'en' ? 'हिन्दी (Hindi)' : 'English'}`}
        >
          {language === 'en' ? 'हिन्दी' : 'English'}
        </button>
      </div>
    </header>
  );
};
