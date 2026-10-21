import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search as SearchIcon, ArrowRight, RotateCcw, AlertTriangle, ShieldCheck, WifiOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient, ApiClientError } from '../api/client';
import type { SearchCandidate, ComparisonItem, CompareResponse } from '../api/types';
import { SearchSuggestions } from '../components/SearchSuggestions';
import { PriceComparisonHero } from '../components/PriceComparisonHero';
import {
  addOrUpdateReportWithItem,
  getCatalogueCache,
  saveCatalogueCache,
  searchOfflineCatalogue
} from '../storage/indexedDb';

export const SearchPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isFixtureSearch, setIsFixtureSearch] = useState(false);

  // Selected item and comparison state
  const [selectedCandidate, setSelectedCandidate] = useState<SearchCandidate | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [packCount, setPackCount] = useState<number>(1);
  const [comparisonItem, setComparisonItem] = useState<ComparisonItem | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isFixtureCompare, setIsFixtureCompare] = useState(false);

  // Keyboard navigation index in suggestion dropdown
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Abort controllers for debouncing and cancelling stale requests
  const searchAbortRef = useRef<AbortController | null>(null);
  const compareAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial catalogue cache sync in background
  useEffect(() => {
    let active = true;
    const syncCatalogue = async () => {
      try {
        const cached = await getCatalogueCache();
        const res = await apiClient.getPublicCatalogue(cached?.etag || null);
        if (active && res.data && res.data.records && res.data.records.length > 0) {
          await saveCatalogueCache(res.data, res.etag);
        }
      } catch (err) {
        console.warn('Initial public catalogue sync could not reach server:', err);
      }
    };
    syncCatalogue();
    return () => {
      active = false;
    };
  }, []);

  // 2. Debounced search trigger
  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setCandidates([]);
      setSearchError(null);
      setIsSearching(false);
      setShowSuggestions(false);
      return;
    }

    // Cancel existing search request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);
    setHighlightedIndex(-1);

    try {
      const response = await apiClient.search(trimmed, 8, controller.signal);
      setCandidates(response.candidates);
      setIsOfflineMode(false);
      setIsFixtureSearch(Boolean(response.isFixture));
      setShowSuggestions(response.candidates.length > 0);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'TIMEOUT_ERROR') {
        // aborted or timed out
        return;
      }

      // Check offline catalogue fallback
      try {
        const offlineRecords = await searchOfflineCatalogue(trimmed);
        if (offlineRecords.length > 0) {
          const offlineCandidates: SearchCandidate[] = offlineRecords.map((r) => ({
            medicine_id: r.medicine_id,
            matched_text: r.name,
            molecule_label: r.molecule_label,
            strength_label: r.strength_label,
            form: r.form,
            release_type: null,
            pack_label: 'Standard Pack',
            brands: [],
            match_score: 80,
            requires_confirmation: true
          }));
          setCandidates(offlineCandidates);
          setIsOfflineMode(true);
          setShowSuggestions(true);
          return;
        }
      } catch {
        // fallback lookup error
      }

      setSearchError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to reach medicine search service. Please verify your connection.'
      );
      setCandidates([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val);
    }, 280);
  };

  // 3. Compare when a candidate is selected
  const executeCompare = useCallback(
    async (candidate: SearchCandidate, brandId: string | null, count: number) => {
      if (isOfflineMode) {
        setCompareError('Price comparison requires a verified online connection. Offline suggestions only provide medicine labels.');
        setComparisonItem(null);
        return;
      }

      if (compareAbortRef.current) {
        compareAbortRef.current.abort();
      }
      const controller = new AbortController();
      compareAbortRef.current = controller;

      setIsComparing(true);
      setCompareError(null);

      try {
        const res: CompareResponse & { isFixture?: boolean } = await apiClient.compare(
          {
            items: [
              {
                medicine_id: candidate.medicine_id,
                brand_id: brandId,
                pack_count: count
              }
            ]
          },
          controller.signal
        );

        if (res.items && res.items.length > 0) {
          setComparisonItem(res.items[0]);
          setIsFixtureCompare(Boolean(res.isFixture));
        } else {
          setCompareError('No comparison data returned by server.');
          setComparisonItem(null);
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError && err.code === 'TIMEOUT_ERROR') {
          return;
        }
        setCompareError(
          err instanceof ApiClientError
            ? err.message
            : 'Failed to verify price comparison. Please retry.'
        );
        setComparisonItem(null);
      } finally {
        setIsComparing(false);
      }
    },
    [isOfflineMode]
  );

  const handleSelectCandidate = (candidate: SearchCandidate) => {
    setSelectedCandidate(candidate);
    setShowSuggestions(false);
    const defaultBrand = candidate.brands.length > 0 ? candidate.brands[0].brand_id : null;
    setSelectedBrandId(defaultBrand);
    executeCompare(candidate, defaultBrand, packCount);
  };

  const handleBrandChange = (brandId: string | null) => {
    setSelectedBrandId(brandId);
    if (selectedCandidate) {
      executeCompare(selectedCandidate, brandId, packCount);
    }
  };

  const handlePackCountChange = (count: number) => {
    setPackCount(count);
    if (selectedCandidate) {
      executeCompare(selectedCandidate, selectedBrandId, count);
    }
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || candidates.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : candidates.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < candidates.length) {
        handleSelectCandidate(candidates[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleAddToPrescription = async (item: ComparisonItem, count: number) => {
    const reportId = await addOrUpdateReportWithItem(item, count);
    navigate(`/prescriptions/${reportId}`);
  };

  return (
    <section aria-labelledby="search-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="search-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.searchTitle}
        </h2>
        <p className="card-desc">
          {t.searchHelpText}
        </p>
      </div>

      {/* Accessible Search Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeSearch(query);
        }}
        role="search"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}
      >
        <label htmlFor="medicine-search-input" className="input-label">
          {t.searchAriaLabel}
        </label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="medicine-search-input"
            type="search"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (candidates.length > 0) setShowSuggestions(true);
            }}
            placeholder={t.searchPlaceholder}
            className="input-field"
            style={{ paddingLeft: '44px', paddingRight: isSearching ? '80px' : '14px' }}
            autoComplete="off"
            spellCheck="false"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="medicine-suggestions-list"
          />
          <SearchIcon
            size={22}
            color="#6b7280"
            aria-hidden="true"
            style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}
          />
          {isSearching && (
            <div
              style={{
                position: 'absolute',
                right: '14px',
                fontSize: '0.8rem',
                color: 'var(--color-primary)',
                fontWeight: 600
              }}
            >
              Searching…
            </div>
          )}
        </div>

        {/* Live debounced suggestions */}
        {showSuggestions && (
          <SearchSuggestions
            candidates={candidates}
            selectedIndex={highlightedIndex}
            onSelectCandidate={handleSelectCandidate}
            isOfflineCached={isOfflineMode}
          />
        )}
      </form>

      {/* Offline Indicator if in offline mode */}
      {isOfflineMode && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.88rem',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <WifiOff size={18} color="#b45309" />
          <span>
            Offline Mode: Showing cached medicine labels from this device. Live price comparison requires an internet connection.
          </span>
        </div>
      )}

      {/* Search Error State with Retry Button and Query Preservation */}
      {searchError && (
        <div
          className="card"
          role="alert"
          style={{
            borderLeft: '4px solid #ef4444',
            background: 'var(--color-error-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#b91c1c" />
            <strong style={{ color: 'var(--color-error-text)', fontSize: '1rem' }}>
              Search Service Unavailable
            </strong>
          </div>
          <p style={{ fontSize: '0.92rem', color: '#7f1d1d' }}>{searchError}</p>
          <p style={{ fontSize: '0.85rem', color: '#991b1b' }}>
            Your entered query <code style={{ fontWeight: 700 }}>"{query}"</code> was preserved.
          </p>
          <div>
            <button
              type="button"
              onClick={() => executeSearch(query)}
              className="btn-secondary"
              style={{ minHeight: '44px', padding: '6px 14px' }}
            >
              <RotateCcw size={16} />
              <span>Retry Search</span>
            </button>
          </div>
        </div>
      )}

      {/* Selected Candidate Brand Selector */}
      {selectedCandidate && (
        <div className="card" style={{ background: '#f8faf9', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Selected Formulation:</span>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedCandidate.matched_text}</h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCandidate(null);
                setComparisonItem(null);
                setShowSuggestions(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                textDecoration: 'underline'
              }}
            >
              Change Formulation
            </button>
          </div>

          {selectedCandidate.brands && selectedCandidate.brands.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label htmlFor="brand-selector" style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                Compare Against Brand MRP:
              </label>
              <select
                id="brand-selector"
                value={selectedBrandId || ''}
                onChange={(e) => handleBrandChange(e.target.value || null)}
                className="input-field"
                style={{ width: 'auto', minHeight: '42px', padding: '4px 10px' }}
              >
                {selectedCandidate.brands.map((b) => (
                  <option key={b.brand_id} value={b.brand_id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Comparison Loading State */}
      {isComparing && (
        <div className="card" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <p style={{ fontSize: '1rem', color: 'var(--color-primary)', fontWeight: 600 }}>
            Verifying PMBJP and market reference pricing…
          </p>
        </div>
      )}

      {/* Comparison Error State */}
      {compareError && (
        <div
          className="card"
          role="alert"
          style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#b45309" />
            <strong style={{ color: '#92400e', fontSize: '1rem' }}>
              Comparison Information
            </strong>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#78350f' }}>{compareError}</p>
        </div>
      )}

      {/* Price Comparison Hero Component */}
      {comparisonItem && !isComparing && (
        <PriceComparisonHero
          item={comparisonItem}
          packCount={packCount}
          onPackCountChange={handlePackCountChange}
          onAddToPrescription={handleAddToPrescription}
          isFixture={isFixtureCompare || isFixtureSearch}
        />
      )}

      {/* Empty Search Prompt if no query entered yet */}
      {!query && !selectedCandidate && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="status-badge success">Verified Search Active</span>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>RapidFuzz WRatio &ge; 75</span>
          </div>
          <h3 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="var(--color-primary)" />
            Search Any Brand or Generic Molecule
          </h3>
          <p className="card-desc" style={{ marginBottom: '14px' }}>
            Enter popular brand names (e.g. <em>Dolo</em>, <em>Calpol</em>, <em>Glycomet</em>, <em>Atorva</em>) or molecule names (e.g. <em>Paracetamol</em>, <em>Metformin</em>). Typos are tolerated automatically.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <Link to="/scan" className="btn-secondary" style={{ flex: '1 1 200px' }}>
              <span>{t.navScan}</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/stores" className="btn-secondary" style={{ flex: '1 1 200px' }}>
              <span>{t.navStores}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
};
