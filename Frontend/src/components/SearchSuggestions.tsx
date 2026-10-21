import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import type { SearchCandidate } from '../api/types';

interface SearchSuggestionsProps {
  candidates: SearchCandidate[];
  selectedIndex: number;
  onSelectCandidate: (candidate: SearchCandidate) => void;
  isOfflineCached?: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  candidates,
  selectedIndex,
  onSelectCandidate,
  isOfflineCached = false
}) => {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll active item into view if keyboard navigated
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div
      className="card"
      style={{
        padding: '8px',
        border: '2px solid var(--color-primary)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        marginTop: '-10px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '0.82rem',
          color: '#4b5563'
        }}
      >
        <span>
          <strong>Select Exact Formulation &amp; Strength</strong>
        </span>
        {isOfflineCached && (
          <span className="status-badge warning" style={{ fontSize: '0.75rem' }}>
            Offline Stale Suggestions
          </span>
        )}
      </div>

      <ul
        ref={listRef}
        role="listbox"
        aria-label="Medicine search suggestions"
        style={{ listStyle: 'none', maxHeight: '340px', overflowY: 'auto', padding: '4px 0' }}
      >
        {candidates.map((candidate, index) => {
          const isSelected = index === selectedIndex;
          return (
            <li
              key={candidate.medicine_id}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectCandidate(candidate)}
              style={{
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
                borderLeft: isSelected ? '4px solid var(--color-primary)' : '4px solid transparent',
                marginBottom: '4px',
                transition: 'background-color 0.1s ease',
                minHeight: '48px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-main)' }}>
                  {candidate.matched_text}
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    background: '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: '#4b5563'
                  }}
                >
                  Score: {candidate.match_score}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.86rem', color: '#374151' }}>
                <span>
                  <strong>Molecule:</strong> {candidate.molecule_label}
                </span>
                <span>•</span>
                <span>
                  <strong>Strength:</strong> {candidate.strength_label}
                </span>
                <span>•</span>
                <span>
                  <strong>Form:</strong> {candidate.form}
                </span>
                {candidate.release_type && (
                  <>
                    <span>•</span>
                    <span>{candidate.release_type}</span>
                  </>
                )}
                <span>•</span>
                <span>
                  <strong>Pack:</strong> {candidate.pack_label}
                </span>
              </div>

              {candidate.brands && candidate.brands.length > 0 && (
                <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px' }}>
                  <strong>Known Brands:</strong> {candidate.brands.map((b) => b.name).join(', ')}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.78rem',
          color: '#6b7280'
        }}
      >
        <AlertCircle size={14} />
        <span>Match score represents search ranking only, not clinical confidence.</span>
      </div>
    </div>
  );
};
