import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Printer,
  Calendar,
  PhoneCall,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  Trash2,
  FileQuestion,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getPrescriptionReport,
  savePrescriptionReport,
  computeReportTotals,
  type PrescriptionReport
} from '../storage/indexedDb';
import { apiClient } from '../api/client';
import { formatPaise, formatPercent } from '../utils/currency';
import { ChemistSlip } from '../components/ChemistSlip';

export const PrescriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();

  const [report, setReport] = useState<PrescriptionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [showSlipPreview, setShowSlipPreview] = useState(false);

  // 1. Load report from IndexedDB
  const loadReport = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);

    try {
      const stored = await getPrescriptionReport(id);
      if (!stored) {
        setNotFound(true);
        setReport(null);
      } else {
        setReport(stored);
      }
    } catch (err) {
      console.error('Failed to load report from IndexedDB:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // 2. Online re-comparison to ensure fresh verified data
  useEffect(() => {
    if (!report || report.items.length === 0) return;

    let active = true;
    const recompareOnline = async () => {
      setIsRefreshing(true);
      try {
        const compareReq = {
          items: report.items.map((i) => ({
            medicine_id: i.medicine_id,
            brand_id: i.brand_id,
            pack_count: i.pack_count
          }))
        };

        const res = await apiClient.compare(compareReq);
        if (active && res.items && res.items.length > 0) {
          const updatedItems = report.items.map((existingItem) => {
            const matched = res.items.find((r) => r.medicine_id === existingItem.medicine_id);
            if (matched) {
              return {
                ...existingItem,
                pmbjp_product_code: matched.pmbjp_product_code || existingItem.pmbjp_product_code,
                brand_name: matched.brand_name || existingItem.brand_name,
                comparison_snapshot: {
                  market_price: matched.market_price,
                  pmbjp_price: matched.pmbjp_price,
                  nppa_ceiling_price: matched.nppa_ceiling_price,
                  saving_paise: matched.saving_paise,
                  saving_percent: matched.saving_percent,
                  comparison_basis: matched.comparison_basis,
                  excluded_reason: matched.excluded_reason
                }
              };
            }
            return existingItem;
          });

          const newTotals = computeReportTotals(updatedItems);
          const updatedReport: PrescriptionReport = {
            ...report,
            items: updatedItems,
            totals_snapshot: newTotals,
            updated_at: new Date().toISOString()
          };

          await savePrescriptionReport(updatedReport);
          setReport(updatedReport);
          setRefreshNotice('Prices verified against latest PMBJP catalogue.');
        }
      } catch {
        if (active) {
          setRefreshNotice('Using saved offline price snapshot.');
        }
      } finally {
        if (active) setIsRefreshing(false);
      }
    };

    recompareOnline();
    return () => {
      active = false;
    };
  }, [id]); // Only run on mount / id change

  // Quantity change handler
  const handleQuantityChange = async (index: number, newCount: number) => {
    if (!report) return;
    const count = Math.max(1, newCount);
    const updatedItems = [...report.items];
    updatedItems[index] = { ...updatedItems[index], pack_count: count };

    const newTotals = computeReportTotals(updatedItems);
    const updatedReport: PrescriptionReport = {
      ...report,
      items: updatedItems,
      totals_snapshot: newTotals,
      updated_at: new Date().toISOString()
    };

    await savePrescriptionReport(updatedReport);
    setReport(updatedReport);
  };

  // Remove item handler
  const handleRemoveItem = async (index: number) => {
    if (!report) return;
    const updatedItems = report.items.filter((_, idx) => idx !== index);
    const newTotals = computeReportTotals(updatedItems);
    const updatedReport: PrescriptionReport = {
      ...report,
      items: updatedItems,
      totals_snapshot: newTotals,
      updated_at: new Date().toISOString()
    };

    await savePrescriptionReport(updatedReport);
    setReport(updatedReport);
  };

  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
        <p style={{ fontSize: '1.05rem', color: 'var(--color-primary)', fontWeight: 600 }}>
          {t.loading}
        </p>
      </div>
    );
  }

  // Not Found state (Honest & Recoverable)
  if (notFound || !report) {
    return (
      <section style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <FileQuestion size={48} color="#9ca3af" />
        <h2 className="card-title" style={{ fontSize: '1.35rem' }}>
          Report Not Found
        </h2>
        <p className="card-desc" style={{ maxWidth: '420px' }}>
          No local report was found with ID <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{id}</code>. Reports are stored locally in your browser; clearing website data removes prior history.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
          <Link to="/" className="btn-primary">
            <span>Search New Medicine</span>
          </Link>
          <Link to="/history" className="btn-secondary">
            <span>View Saved History</span>
          </Link>
        </div>
      </section>
    );
  }

  const totals = report.totals_snapshot;
  const isComparableBasket = totals.saving_total_paise !== null && totals.saving_total_paise !== undefined;

  return (
    <section aria-labelledby="report-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Printable Slip (Rendered only on print or when preview toggled) */}
      <div className="print-only">
        <ChemistSlip report={report} />
      </div>

      {/* Screen View */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
            <h2 id="report-heading" className="card-title" style={{ fontSize: '1.4rem', margin: 0 }}>
              {t.prescriptionTitle}
            </h2>
            <span className="status-badge success">
              Report #{report.report_id.slice(0, 8)}
            </span>
          </div>
          <p className="card-desc">
            {t.prescriptionSubtitle}
          </p>
          {refreshNotice && (
            <p style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '4px' }}>
              • {refreshNotice} {isRefreshing && '(refreshing…)'}
            </p>
          )}
        </div>

        {/* Basket Savings Summary Card */}
        {isComparableBasket ? (
          <div
            className="card"
            style={{
              background: 'var(--color-save-bg)',
              border: '2px solid var(--color-save-badge)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-save-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Total Estimated Potential Savings
              </span>
              <span
                style={{
                  background: 'var(--color-save-badge)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  padding: '4px 12px',
                  borderRadius: '9999px'
                }}
              >
                Save {formatPercent(totals.saving_percent)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem', color: '#6b7280', textDecoration: 'line-through' }}>
                {formatPaise(totals.market_total_paise)}
              </span>
              <span style={{ fontSize: '1.2rem', color: '#6b7280' }}>&rarr;</span>
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-save-text)' }}>
                {formatPaise(totals.pmbjp_total_paise)}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-save-badge)' }}>
                (Save {formatPaise(totals.saving_total_paise)})
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#047857' }}>
              *Savings calculated across {totals.comparable_item_count} verified comparable item(s).
              {totals.incomplete_item_count > 0 &&
                ` ${totals.incomplete_item_count} item(s) without comparable brand price are excluded from total savings.`}
            </p>
          </div>
        ) : (
          <div className="card" style={{ background: '#fffbeb', border: '2px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <AlertTriangle size={20} color="#b45309" />
              <strong style={{ color: '#92400e', fontSize: '1.05rem' }}>
                Estimated Generic Cost: {formatPaise(totals.pmbjp_total_paise)}
              </strong>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#78350f' }}>
              No complete like-for-like branded comparison is available for these items. In accordance with data policy, no hypothetical savings are calculated.
            </p>
          </div>
        )}

        {/* Confirmed Medicine Basket Rows */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
              Confirmed Basket Medicines ({report.items.length})
            </h3>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
              <PlusCircle size={16} />
              <span>Add More Medicines</span>
            </Link>
          </div>

          {report.items.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.92rem' }}>No medicines currently in this report basket.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {report.items.map((item, idx) => {
                const snap = item.comparison_snapshot;
                const isLineComparable = snap.saving_paise !== null && snap.saving_paise !== undefined;
                const lineMarketTotal = snap.market_price ? snap.market_price.amount_paise * item.pack_count : null;
                const linePmbjpTotal = snap.pmbjp_price ? snap.pmbjp_price.amount_paise * item.pack_count : null;

                return (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '12px',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{item.matched_text}</span>
                          <span className="status-badge success" style={{ fontSize: '0.72rem' }}>
                            {item.pmbjp_product_code ? `Code: ${item.pmbjp_product_code}` : 'Generic'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }}>
                          {item.molecule_label} • {item.strength_label} • {item.form} • {item.pack_label}
                        </div>
                        {item.brand_name && (
                          <div style={{ fontSize: '0.8rem', color: '#1e40af' }}>
                            Branded ref: {item.brand_name}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem'
                        }}
                        aria-label={`Remove ${item.matched_text}`}
                      >
                        <Trash2 size={16} />
                        <span>Remove</span>
                      </button>
                    </div>

                    {/* Price and pack counter */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label htmlFor={`pack-qty-${idx}`} style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                          Quantity (Packs):
                        </label>
                        <select
                          id={`pack-qty-${idx}`}
                          value={item.pack_count}
                          onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value, 10) || 1)}
                          className="input-field"
                          style={{ width: '70px', minHeight: '38px', padding: '4px 8px' }}
                        >
                          {[1, 2, 3, 4, 5, 10].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {isLineComparable ? (
                          <div>
                            <span style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'line-through', marginRight: '6px' }}>
                              {formatPaise(lineMarketTotal)}
                            </span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-save-text)' }}>
                              {formatPaise(linePmbjpTotal)}
                            </span>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-save-badge)', fontWeight: 700 }}>
                              Save {formatPaise(snap.saving_paise ? snap.saving_paise * item.pack_count : null)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                              {formatPaise(linePmbjpTotal)}
                            </span>
                            <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
                              {snap.excluded_reason || 'Missing comparable brand MRP'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chemist Slip Print & Preview Action */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: '1.1rem', margin: 0 }}>
                Chemist Counter Slip
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                Print or save PDF counter slip with verified molecules, PMBJP codes, and required disclaimer.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary"
            >
              <Printer size={18} />
              <span>{t.printSlip}</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSlipPreview(!showSlipPreview)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{showSlipPreview ? 'Hide Slip Preview' : 'Show Slip Preview'}</span>
              {showSlipPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showSlipPreview && (
            <div style={{ marginTop: '8px' }}>
              <ChemistSlip report={report} />
            </div>
          )}
        </div>

        {/* Confirmed Checkup Details (if confirmed in Phase F2) */}
        {report.checkup && report.checkup.confirmed && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="var(--color-primary)" />
              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Confirmed Clinic Checkup Details</h4>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#374151' }}>
              <strong>Date:</strong> {report.checkup.date_local || 'Scheduled'} • <strong>Time:</strong> {report.checkup.time_local || 'TBD'} • <strong>Place:</strong> {report.checkup.place}
              {report.checkup.doctor && ` • Doctor: ${report.checkup.doctor}`}
            </p>
          </div>
        )}

        {/* Phase F6 Reminders & Call Actions Readiness Placeholder */}
        <div className="card" style={{ background: '#f9fafb', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
              Reminders &amp; Outbound Call Controls
            </span>
            <span className="status-badge neutral" style={{ fontSize: '0.72rem' }}>
              Phase F6 Target
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled
              aria-disabled="true"
            >
              <Calendar size={18} />
              <span>Set WhatsApp Reminder</span>
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
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Reminder schedules and immediate outbound checkup calls will connect to live backend services in Phase F6. Calls target the backend configured test number only.
          </p>
        </div>

        {/* Navigation Link to History */}
        <div>
          <Link to="/history" className="btn-secondary">
            <span>&larr; View All Saved Reports</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
