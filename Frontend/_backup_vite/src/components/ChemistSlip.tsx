import React from 'react';
import type { PrescriptionReport } from '../storage/indexedDb';
import { formatPaise } from '../utils/currency';

interface ChemistSlipProps {
  report: PrescriptionReport;
}

export const ChemistSlip: React.FC<ChemistSlipProps> = ({ report }) => {
  const formattedDate = new Date(report.created_at).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div
      className="chemist-slip-container"
      style={{
        background: '#ffffff',
        border: '2px solid #111827',
        borderRadius: '8px',
        padding: '20px',
        color: '#111827',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '2px solid #111827', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', margin: 0 }}>
            Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP)
          </h2>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary-dark)', margin: '4px 0 0' }}>
            Chemist Counter Reference Slip • जन औषधि केमिस्ट पर्ची
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#4b5563' }}>
          <div><strong>Report ID:</strong> {report.report_id}</div>
          <div><strong>Date:</strong> {formattedDate}</div>
        </div>
      </div>

      {/* Confirmed Medicine Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #374151', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', width: '38%' }}>Molecule &amp; Formulation</th>
              <th style={{ padding: '8px 10px', width: '18%' }}>PMBJP Code</th>
              <th style={{ padding: '8px 10px', width: '14%' }}>Pack Spec</th>
              <th style={{ padding: '8px 10px', width: '14%', textAlign: 'center' }}>Qty (Packs)</th>
              <th style={{ padding: '8px 10px', width: '16%', textAlign: 'right' }}>Est. Generic Total</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item, idx) => {
              const pmbjpUnitPaise = item.comparison_snapshot.pmbjp_price?.amount_paise || null;
              const lineTotalPaise = pmbjpUnitPaise !== null ? pmbjpUnitPaise * item.pack_count : null;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{item.matched_text}</div>
                    <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                      {item.molecule_label} • {item.strength_label} • {item.form}
                    </div>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {item.pmbjp_product_code || 'Not verified'}
                  </td>
                  <td style={{ padding: '10px' }}>{item.pack_label}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>
                    {item.pack_count}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>
                    {formatPaise(lineTotalPaise)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #111827', background: '#f9fafb' }}>
              <td colSpan={4} style={{ padding: '10px', fontWeight: 800, textAlign: 'right', fontSize: '1rem' }}>
                Total Estimated PMBJP Generic Cost:
              </td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', color: 'var(--color-primary-dark)' }}>
                {formatPaise(report.totals_snapshot.pmbjp_total_paise)}
              </td>
            </tr>
            {report.totals_snapshot.saving_total_paise !== null && (
              <tr style={{ background: '#ecfdf5' }}>
                <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', fontSize: '0.9rem', color: '#065f46' }}>
                  Estimated Potential Savings vs Branded Market MRP:
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#047857' }}>
                  {formatPaise(report.totals_snapshot.saving_total_paise)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Mandatory Medical Disclaimer (Print and Screen) */}
      <div
        style={{
          border: '1.5px solid #b45309',
          background: '#fffbeb',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '0.82rem',
          lineHeight: '1.4',
          color: '#78350f'
        }}
      >
        <p style={{ margin: 0, fontWeight: 700 }}>
          <strong>Medical Notice:</strong> Informational only — confirm with doctor or pharmacist before substituting.
        </p>
        <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
          <strong>चिकित्सा सूचना:</strong> केवल सूचनात्मक — दवा बदलने से पहले डॉक्टर या फार्मासिस्ट से पुष्टि करें।
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#92400e' }}>
          *Stock availability at a specific Jan Aushadhi Kendra is not guaranteed. Brand MRP references are dated market figures; lawful retail prices may vary.
        </p>
      </div>

      {/* Footer Notes */}
      <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
        <span>Generated by AushadhAi • Client-side record</span>
        <span>Sources: PMBI Jan Aushadhi Portfolio &amp; NPPA Pharma Sahi Daam</span>
      </div>
    </div>
  );
};
