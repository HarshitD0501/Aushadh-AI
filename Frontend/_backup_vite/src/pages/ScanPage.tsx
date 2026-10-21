import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileText,
  Search,
  RotateCcw,
  XCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient, ApiClientError } from '../api/client';
import type { OcrResponse, SearchCandidate, ComparisonItem } from '../api/types';
import { SearchSuggestions } from '../components/SearchSuggestions';
import { PriceComparisonHero } from '../components/PriceComparisonHero';
import { useNavigate } from 'react-router-dom';
import { addOrUpdateReportWithItem } from '../storage/indexedDb';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ScanPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // File selection & preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // OCR state
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResponse, setOcrResponse] = useState<OcrResponse | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isFixture, setIsFixture] = useState(false);
  const ocrAbortRef = useRef<AbortController | null>(null);

  // Manual correction & search fallback state
  const [correctionQuery, setCorrectionQuery] = useState('');
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<SearchCandidate | null>(null);
  const [packCount, setPackCount] = useState<number>(1);
  const [comparisonItem, setComparisonItem] = useState<ComparisonItem | null>(null);

  // Optional checkup details
  const [checkupDate, setCheckupDate] = useState('');
  const [checkupTime, setCheckupTime] = useState('');
  const [checkupPlace, setCheckupPlace] = useState('');
  const [checkupDoctor, setCheckupDoctor] = useState('');
  const [checkupConfirmed, setCheckupConfirmed] = useState(false);

  // Hidden file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Validate and stage file
  const handleFileChange = (file: File | null) => {
    setValidationError(null);
    setOcrError(null);
    setOcrResponse(null);

    if (!file) {
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setValidationError('Unsupported file format. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setValidationError(`Image is too large (${sizeMb} MB). Maximum allowed size is 5.0 MB.`);
      return;
    }

    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Run OCR
  const handleProcessOcr = async () => {
    if (!selectedFile) return;

    if (ocrAbortRef.current) {
      ocrAbortRef.current.abort();
    }
    const controller = new AbortController();
    ocrAbortRef.current = controller;

    setIsProcessing(true);
    setOcrError(null);
    setOcrResponse(null);

    try {
      const res = await apiClient.processOcr(selectedFile, controller.signal);
      setOcrResponse(res);
      setIsFixture(Boolean(res.isFixture));

      // Prepopulate correction query if tokens exist
      if (res.suggestions.length > 0 && res.suggestions[0].query_tokens.length > 0) {
        const initialQuery = res.suggestions[0].query_tokens.join(' ');
        setCorrectionQuery(initialQuery);
        // Automatically search catalogue with candidate query
        triggerSearch(initialQuery);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'TIMEOUT_ERROR') {
        setOcrError('OCR processing timed out. You can use manual search below.');
        return;
      }
      setOcrError(
        err instanceof ApiClientError
          ? err.message
          : 'Failed to process prescription image. Please check your network or enter medicine name below.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelOcr = () => {
    if (ocrAbortRef.current) {
      ocrAbortRef.current.abort();
    }
    setIsProcessing(false);
  };

  const handleResetFile = () => {
    if (ocrAbortRef.current) {
      ocrAbortRef.current.abort();
    }
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setOcrResponse(null);
    setOcrError(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Manual search trigger
  const triggerSearch = async (searchTerm: string) => {
    const q = searchTerm.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await apiClient.search(q, 6);
      setCandidates(res.candidates);
    } catch (err: unknown) {
      setSearchError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to reach medicine search service.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = async (candidate: SearchCandidate) => {
    setSelectedCandidate(candidate);
    const defaultBrand = candidate.brands.length > 0 ? candidate.brands[0].brand_id : null;

    try {
      const res = await apiClient.compare({
        items: [{ medicine_id: candidate.medicine_id, brand_id: defaultBrand, pack_count: packCount }]
      });
      if (res.items.length > 0) {
        setComparisonItem(res.items[0]);
      }
    } catch (err) {
      console.warn('Comparison failed:', err);
    }
  };

  const handleProceedToReport = async () => {
    let reportId: string;
    if (comparisonItem) {
      const checkupData = checkupConfirmed
        ? {
            date_local: checkupDate,
            time_local: checkupTime,
            place: checkupPlace,
            doctor: checkupDoctor || null,
            confirmed: true
          }
        : null;
      reportId = await addOrUpdateReportWithItem(comparisonItem, packCount, undefined, checkupData);
    } else {
      reportId = `rep-${Date.now()}`;
    }
    navigate(`/prescriptions/${reportId}`);
  };

  return (
    <section aria-labelledby="scan-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="scan-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.scanTitle}
        </h2>
        <p className="card-desc">
          {t.scanSubtitle}
        </p>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
      />

      {/* Upload & Camera Trigger Controls */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ fontSize: '0.92rem', color: '#4b5563' }}>
          Supports printed medicine strips, boxes, and prescription labels (JPEG, PNG, WebP up to 5 MB).
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn-primary"
            style={{ flex: '1 1 200px' }}
          >
            <Camera size={20} />
            <span>{t.cameraButton}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            style={{ flex: '1 1 200px' }}
          >
            <Upload size={20} />
            <span>{t.uploadButton}</span>
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              color: '#991b1b',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '0.88rem'
            }}
          >
            <AlertTriangle size={18} color="#b91c1c" style={{ flexShrink: 0 }} />
            <span>{validationError}</span>
          </div>
        )}

        {/* Image Preview & Upload Execution */}
        {selectedFile && previewUrl && (
          <div
            style={{
              background: '#f9fafb',
              border: '2px dashed var(--color-border)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--color-primary)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedFile.name}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetFile}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}
              >
                <XCircle size={16} />
                <span>Remove</span>
              </button>
            </div>

            <div style={{ textAlign: 'center', maxHeight: '240px', overflow: 'hidden', borderRadius: '6px' }}>
              <img
                src={previewUrl}
                alt="Prescription preview"
                style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={handleProcessOcr}
                disabled={isProcessing}
                className="btn-primary"
                style={{ flex: '1 1 200px' }}
              >
                <span>{isProcessing ? 'Processing OCR…' : 'Process OCR & Extract Text'}</span>
              </button>
              {isProcessing && (
                <button
                  type="button"
                  onClick={handleCancelOcr}
                  className="btn-secondary"
                  style={{ minWidth: '120px' }}
                >
                  <RotateCcw size={16} />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f3f4f6', padding: '10px 12px', borderRadius: '6px' }}>
          <AlertTriangle size={18} color="#4b5563" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
            {t.ocrNotice}
          </span>
        </div>
      </div>

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
            <strong>Development Fixture:</strong> Local sample OCR text returned because backend OCR service is unreachable.
          </span>
        </div>
      )}

      {/* OCR Error with Permanent Manual Search Fallback */}
      {ocrError && (
        <div
          className="card"
          role="alert"
          style={{ borderLeft: '4px solid #ef4444', background: 'var(--color-error-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#b91c1c" />
            <strong style={{ color: 'var(--color-error-text)', fontSize: '1rem' }}>
              OCR Service Notice
            </strong>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#7f1d1d' }}>{ocrError}</p>
          <p style={{ fontSize: '0.85rem', color: '#991b1b' }}>
            Manual medicine search below is fully operational.
          </p>
        </div>
      )}

      {/* Raw OCR Text & Candidate Review Cards */}
      {ocrResponse && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
              OCR Review &amp; Unconfirmed Candidates
            </h3>
            <span className="status-badge neutral" style={{ fontSize: '0.75rem' }}>
              Normalizer: {ocrResponse.normalization_provider}
            </span>
          </div>

          {/* Warnings from model/OCR */}
          {ocrResponse.warnings && ocrResponse.warnings.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '6px' }}>
              {ocrResponse.warnings.map((w, idx) => (
                <p key={idx} style={{ fontSize: '0.82rem', color: '#92400e' }}>
                  • {w}
                </p>
              ))}
            </div>
          )}

          {/* Raw Text Box */}
          <div>
            <label className="input-label" style={{ fontSize: '0.85rem' }}>
              Raw OCR Observed Text:
            </label>
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '10px 12px',
                fontFamily: 'monospace',
                fontSize: '0.88rem',
                color: '#374151',
                maxHeight: '120px',
                overflowY: 'auto'
              }}
            >
              {ocrResponse.raw_text || '(No legible text detected)'}
            </div>
          </div>

          {/* Candidate suggestions */}
          {ocrResponse.suggestions && ocrResponse.suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className="input-label" style={{ fontSize: '0.88rem' }}>
                Possible Matches (Please confirm):
              </span>
              {ocrResponse.suggestions.map((sugg, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--color-primary-border)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      "{sugg.observed_text}"
                    </span>
                    <span className="status-badge warning" style={{ fontSize: '0.75rem' }}>
                      {sugg.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#4b5563' }}>
                    Extracted tokens: {sugg.query_tokens.join(', ')}
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const tokenStr = sugg.query_tokens.join(' ');
                        setCorrectionQuery(tokenStr);
                        triggerSearch(tokenStr);
                      }}
                      className="btn-secondary"
                      style={{ minHeight: '38px', padding: '4px 12px', fontSize: '0.85rem' }}
                    >
                      <Search size={14} />
                      <span>Search &amp; Confirm Formulation</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permanent Manual Correction & Search Flow */}
      <div className="card" style={{ borderLeft: '4px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
          Permanent Manual Correction &amp; Medicine Lookup
        </h3>
        <p style={{ fontSize: '0.88rem', color: '#4b5563' }}>
          Correct any misspelling or directly search brand or molecule name. Manual search remains permanently active regardless of OCR outcome.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            triggerSearch(correctionQuery);
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="search"
            value={correctionQuery}
            onChange={(e) => setCorrectionQuery(e.target.value)}
            placeholder="Type corrected brand or molecule name…"
            className="input-field"
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={isSearching || !correctionQuery.trim()}
            style={{ minWidth: '110px' }}
          >
            <Search size={18} />
            <span>{isSearching ? 'Searching…' : 'Search'}</span>
          </button>
        </form>

        {searchError && (
          <p style={{ fontSize: '0.85rem', color: '#dc2626' }}>{searchError}</p>
        )}

        {/* Suggestion candidates from manual search */}
        {candidates.length > 0 && !selectedCandidate && (
          <SearchSuggestions
            candidates={candidates}
            selectedIndex={-1}
            onSelectCandidate={handleSelectCandidate}
          />
        )}
      </div>

      {/* Comparison Hero if Candidate Selected */}
      {comparisonItem && (
        <PriceComparisonHero
          item={comparisonItem}
          packCount={packCount}
          onPackCountChange={setPackCount}
          onAddToPrescription={() => {
            handleProceedToReport();
          }}
          isFixture={isFixture}
        />
      )}

      {/* Optional Manual Checkup Details Entry */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
            Optional Checkup Details (Manual Review)
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#4b5563' }}>
            Enter confirmed upcoming clinic or hospital checkup details. Call Patient action on your confirmed report requires explicitly verified details.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label htmlFor="checkup-date-input" className="input-label">
              Checkup Date:
            </label>
            <input
              id="checkup-date-input"
              type="date"
              value={checkupDate}
              onChange={(e) => setCheckupDate(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="checkup-time-input" className="input-label">
              Checkup Time:
            </label>
            <input
              id="checkup-time-input"
              type="time"
              value={checkupTime}
              onChange={(e) => setCheckupTime(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="checkup-place-input" className="input-label">
              Clinic / Hospital Place:
            </label>
            <input
              id="checkup-place-input"
              type="text"
              placeholder="e.g. Community Health Centre"
              value={checkupPlace}
              onChange={(e) => setCheckupPlace(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="checkup-doctor-input" className="input-label">
              Doctor Name (Optional):
            </label>
            <input
              id="checkup-doctor-input"
              type="text"
              placeholder="e.g. Dr. Sharma"
              value={checkupDoctor}
              onChange={(e) => setCheckupDoctor(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <input
            id="confirm-checkup-checkbox"
            type="checkbox"
            checked={checkupConfirmed}
            onChange={(e) => setCheckupConfirmed(e.target.checked)}
            style={{ width: '22px', height: '22px', cursor: 'pointer' }}
          />
          <label
            htmlFor="confirm-checkup-checkbox"
            style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-text-main)', cursor: 'pointer' }}
          >
            I confirm these checkup details are reviewed and accurate.
          </label>
        </div>

        {checkupConfirmed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ecfdf5',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #a7f3d0',
              fontSize: '0.85rem',
              color: '#065f46'
            }}
          >
            <CheckCircle size={16} />
            <span>Checkup confirmed: Outbound call action will be enabled on report.</span>
          </div>
        )}
      </div>

      {/* Navigation actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          onClick={handleProceedToReport}
          className="btn-primary"
          style={{ flex: '1 1 220px' }}
        >
          <span>View Prescription Report</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
};
