import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <section style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      <HelpCircle size={48} color="#9ca3af" />
      <h2 className="card-title" style={{ fontSize: '1.4rem' }}>
        Page Not Found
      </h2>
      <p className="card-desc" style={{ maxWidth: '400px' }}>
        The page you requested could not be found. AushadhAi features five dedicated routes: Search, Scan, Report Detail, Stores, and History.
      </p>
      <Link to="/" className="btn-primary" style={{ marginTop: '10px' }}>
        <ArrowLeft size={18} />
        <span>Return to Search</span>
      </Link>
    </section>
  );
};
