import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer" role="contentinfo">
      <p>
        <strong>AushadhAi</strong> — Verified medicine price transparency PWA.
      </p>
      <p>
        Data provenance: Official PMBI Jan Aushadhi &amp; NPPA Pharma Sahi Daam reference records.
      </p>
      <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
        Phase F0 Foundation • Client-side local storage only • No tracking or account sync
      </p>
    </footer>
  );
};
