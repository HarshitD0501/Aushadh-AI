import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Info,
  Search,
  Camera,
  Trash2,
  ExternalLink,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import {
  getAllPrescriptionReports,
  deletePrescriptionReport,
  type PrescriptionReport
} from '../storage/indexedDb';
import { formatPaise, formatPercent } from '../utils/currency';

export const HistoryPage: React.FC = () => {
  const { t } = useLanguage();

  const [reports, setReports] = useState<PrescriptionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load all reports from IndexedDB
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await getAllPrescriptionReports();
      setReports(stored);
    } catch (err) {
      console.error('Failed to load local history from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await deletePrescriptionReport(deleteTargetId);
      setReports((prev) => prev.filter((r) => r.report_id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute aggregate potential savings from comparable lines only
  const aggregateSavingsPaise = reports.reduce((acc, r) => {
    return acc + (r.totals_snapshot.saving_total_paise || 0);
  }, 0);

  const aggregateComparableItems = reports.reduce((acc, r) => {
    return acc + (r.totals_snapshot.comparable_item_count || 0);
  }, 0);

  const totalMedicines = reports.reduce((acc, r) => {
    return acc + r.items.length;
  }, 0);

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

      {/* Device-Local Privacy Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          background: '#eff6ff',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid #bfdbfe'
        }}
      >
        <Info size={20} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span style={{ fontSize: '0.88rem', color: '#1e40af', lineHeight: '1.4' }}>
          {t.localOnlyWarning}
        </span>
      </div>

      {/* Delete Confirmation Modal / Prompt */}
      {deleteTargetId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          style={{
            background: '#fef2f2',
            border: '2px solid #ef4444',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#dc2626" />
            <h3 id="delete-dialog-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
              Delete Report #{deleteTargetId.slice(0, 8)}?
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#7f1d1d', margin: 0 }}>
            Are you sure you want to delete this confirmed report from this device? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="btn-primary"
              style={{ background: '#dc2626', borderColor: '#b91c1c', minHeight: '42px', padding: '6px 14px' }}
            >
              <span>{isDeleting ? 'Deleting…' : 'Yes, Delete Report'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              disabled={isDeleting}
              className="btn-secondary"
              style={{ minHeight: '42px', padding: '6px 14px' }}
            >
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Aggregate Savings Summary Banner (When reports exist) */}
      {!loading && reports.length > 0 && (
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-save-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Aggregate Estimated Potential Savings
            </span>
            <span className="status-badge success" style={{ fontSize: '0.78rem' }}>
              {reports.length} Saved Report{reports.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--color-save-text)' }}>
            {formatPaise(aggregateSavingsPaise)}
          </div>

          <p style={{ fontSize: '0.82rem', color: '#047857', margin: 0 }}>
            *Cumulative estimated potential savings across {aggregateComparableItems} verified comparable line(s) in {reports.length} report(s). Sourced from dated market reference figures.
          </p>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
          <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Loading saved reports from this device…</p>
        </div>
      ) : reports.length === 0 ? (
        /* Honest Empty History State */
        <div className="card" style={{ textAlign: 'center', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Clock size={44} color="#9ca3af" />
          <h3 className="card-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            {t.emptyHistoryTitle}
          </h3>
          <p className="card-desc" style={{ maxWidth: '420px', margin: 0 }}>
            {t.emptyHistoryDesc}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
              Device Saved Reports ({reports.length})
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
              {totalMedicines} total medicine items
            </span>
          </div>

          {reports.map((report) => {
            const dateStr = new Date(report.created_at).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const snapshotDate = new Date(report.updated_at || report.created_at).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            const totals = report.totals_snapshot;
            const hasComparable = totals.saving_total_paise !== null && totals.saving_total_paise !== undefined;

            return (
              <div
                key={report.report_id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: '1px solid var(--color-border)',
                  borderLeft: '4px solid var(--color-primary)'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="var(--color-primary)" />
                      <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-main)' }}>
                        Report #{report.report_id.slice(0, 8)}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>Snapshot checked: {snapshotDate}</span>
                    </div>
                  </div>

                  <span className="status-badge neutral" style={{ fontSize: '0.75rem' }}>
                    {report.items.length} Medicine{report.items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Molecules Preview */}
                <div style={{ fontSize: '0.88rem', color: '#374151', background: '#f9fafb', padding: '8px 12px', borderRadius: '6px' }}>
                  <strong>Molecules:</strong>{' '}
                  {report.items.map((i) => `${i.matched_text} (${i.pack_count} pk)`).join(', ')}
                </div>

                {/* Price & Savings Snapshot */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>Estimated PMBJP Total:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                      {formatPaise(totals.pmbjp_total_paise)}
                    </div>
                  </div>

                  {hasComparable ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.82rem', color: '#047857', fontWeight: 700 }}>
                        Estimated Potential Saving ({formatPercent(totals.saving_percent)}):
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-save-badge)' }}>
                        Save {formatPaise(totals.saving_total_paise)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: '#92400e', background: '#fffbeb', padding: '4px 8px', borderRadius: '4px' }}>
                      No verified comparable brand price
                    </div>
                  )}
                </div>

                {/* Action Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                  <Link
                    to={`/prescriptions/${report.report_id}`}
                    className="btn-primary"
                    style={{ minHeight: '40px', padding: '6px 14px', fontSize: '0.9rem' }}
                  >
                    <span>Open &amp; Print Slip</span>
                    <ExternalLink size={14} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(report.report_id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      padding: '6px 8px'
                    }}
                    aria-label={`Delete report ${report.report_id}`}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default HistoryPage;
