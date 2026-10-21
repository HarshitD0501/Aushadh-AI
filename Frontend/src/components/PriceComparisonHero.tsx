import React from 'react';
import { ExternalLink, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ComparisonItem } from '../api/types';
import { formatPaise, formatPercent } from '../utils/currency';
import { useLanguage } from '../contexts/LanguageContext';

interface PriceComparisonHeroProps {
  item: ComparisonItem;
  packCount: number;
  onPackCountChange: (count: number) => void;
  onAddToPrescription?: (item: ComparisonItem, packCount: number) => void;
  isFixture?: boolean;
}

export const PriceComparisonHero: React.FC<PriceComparisonHeroProps> = ({
  item,
  packCount,
  onPackCountChange,
  onAddToPrescription,
  isFixture = false
}) => {
  const { t } = useLanguage();

  const isComparable = item.saving_paise !== null && item.saving_paise !== undefined;

  const marketTotalPaise = item.market_price
    ? item.market_price.amount_paise * packCount
    : null;
  const pmbjpTotalPaise = item.pmbjp_price
    ? item.pmbjp_price.amount_paise * packCount
    : null;
  const savingTotalPaise = isComparable && marketTotalPaise && pmbjpTotalPaise
    ? marketTotalPaise - pmbjpTotalPaise
    : null;

  return (
    <div
      className="card"
      style={{
        border: isComparable ? '2px solid var(--color-save-badge)' : '2px solid var(--color-border)',
        boxShadow: isComparable ? '0 4px 16px rgba(4, 120, 87, 0.08)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {/* Dev Fixture Warning Banner if Active */}
      {isFixture && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.82rem',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldAlert size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <span>
            <strong>Development Fixture:</strong> Sourced reference sample shown because backend is currently unreachable.
          </span>
        </div>
      )}

      {/* Header Info: Molecule & Brand */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span className="status-badge success" style={{ fontSize: '0.75rem' }}>
            {item.pmbjp_product_code ? `PMBJP Code: ${item.pmbjp_product_code}` : 'Generic Formulation'}
          </span>
          <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            {item.comparison_basis || item.pack_label}
          </span>
        </div>
        <h3 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '2px' }}>
          {item.matched_text}
        </h3>
        <p style={{ fontSize: '0.92rem', color: '#4b5563' }}>
          <strong>Molecule:</strong> {item.molecule_label} • <strong>Strength:</strong> {item.strength_label} • <strong>Form:</strong> {item.form}
        </p>
        {item.brand_name && (
          <p style={{ fontSize: '0.88rem', color: '#1e40af', marginTop: '2px' }}>
            <strong>Compared Branded MRP Reference:</strong> {item.brand_name}
          </p>
        )}
      </div>

      {/* Comparable Price Transition & Savings Hero */}
      {isComparable ? (
        <div
          style={{
            background: 'var(--color-save-bg)',
            border: '2px solid var(--color-save-badge)',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-save-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Estimated Potential Saving
            </span>
            <span
              style={{
                background: 'var(--color-save-badge)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                padding: '4px 10px',
                borderRadius: '9999px'
              }}
            >
              Save {formatPercent(item.saving_percent)}
            </span>
          </div>

          {/* Large Transition Display */}
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem', color: '#6b7280', textDecoration: 'line-through' }}>
              {formatPaise(marketTotalPaise)}
            </span>
            <span style={{ fontSize: '1.2rem', color: '#6b7280' }}>&rarr;</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-save-text)' }}>
              {formatPaise(pmbjpTotalPaise)}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-save-badge)' }}>
              (Saving: {formatPaise(savingTotalPaise)})
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#047857', lineHeight: '1.3' }}>
            *Estimated potential savings for {packCount} pack ({item.pack_label}). Sourced market MRP reference is dated; actual shop prices may lawfully vary.
          </p>
        </div>
      ) : (
        /* Honest Incomplete / Missing Comparison State */
        <div
          style={{
            background: '#fffbeb',
            border: '2px solid #f59e0b',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#b45309" />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#92400e' }}>
              No verified comparison available
            </h4>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#78350f' }}>
            {item.excluded_reason || 'Missing verified like-for-like brand MRP or generic price record. In accordance with clinical policy, no hypothetical savings are calculated.'}
          </p>
          {item.pmbjp_price && (
            <div style={{ marginTop: '4px', fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Available PMBJP Generic Price: {formatPaise(item.pmbjp_price.amount_paise * packCount)} per {item.pmbjp_price.unit}
            </div>
          )}
        </div>
      )}

      {/* Verified Price Source Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        {/* PMBJP Sourced Record */}
        <div style={{ background: '#f8faf9', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              PMBJP Generic Price
            </span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Checked: {item.pmbjp_price?.checked_on || 'Not verified'}
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '4px' }}>
            {item.pmbjp_price ? formatPaise(item.pmbjp_price.amount_paise) : 'Not available'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Unit: {item.pmbjp_price?.unit || item.pack_label}
          </div>
          {item.pmbjp_price?.source_url && (
            <a
              href={item.pmbjp_price.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '6px' }}
            >
              <span>Verify Official PMBI Record</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Branded Market MRP Sourced Record */}
        <div style={{ background: '#f8faf9', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>
              Branded Market Reference
            </span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Checked: {item.market_price?.checked_on || 'Not verified'}
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '4px' }}>
            {item.market_price ? formatPaise(item.market_price.amount_paise) : 'Not verified'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Brand: {item.brand_name || 'Generic / Unknown'}
          </div>
          {item.market_price?.source_url && (
            <a
              href={item.market_price.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#1e40af', marginTop: '6px' }}
            >
              <span>Pharma Sahi Daam Evidence</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* NPPA Ceiling Price (Shown Separately if applicable) */}
      {item.nppa_ceiling_price && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.85rem',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div>
            <strong>NPPA Ceiling Price Reference:</strong> {formatPaise(item.nppa_ceiling_price.amount_paise)} per {item.nppa_ceiling_price.unit} (Checked: {item.nppa_ceiling_price.checked_on})
            <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '2px' }}>
              Regulatory ceiling price only; never substituted for branded market MRP.
            </div>
          </div>
          {item.nppa_ceiling_price.source_url && (
            <a
              href={item.nppa_ceiling_price.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#1d4ed8' }}
            >
              <span>NPPA Notification</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* Pack Count Controls & Add to Report Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor={`pack-count-${item.medicine_id}`} style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            Packs:
          </label>
          <select
            id={`pack-count-${item.medicine_id}`}
            value={packCount}
            onChange={(e) => onPackCountChange(parseInt(e.target.value, 10) || 1)}
            className="input-field"
            style={{ width: '80px', minHeight: '44px', padding: '6px 10px' }}
          >
            {[1, 2, 3, 4, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {onAddToPrescription && (
          <button
            type="button"
            onClick={() => onAddToPrescription(item, packCount)}
            className="btn-primary"
          >
            <CheckCircle size={18} />
            <span>Add to Prescription Report</span>
          </button>
        )}
      </div>
    </div>
  );
};
