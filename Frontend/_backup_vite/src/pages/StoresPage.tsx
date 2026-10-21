import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  MapPin,
  Compass,
  Navigation as NavIcon,
  Phone,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient, ApiClientError } from '../api/client';
import type { CityRecord, StoreRecord, RouteResponse } from '../api/types';

// Lazy load Leaflet map only on this route to keep first-search bundle small
const LazyStoreMap = lazy(() => import('../components/LazyStoreMap'));

export const StoresPage: React.FC = () => {
  const { t } = useLanguage();

  // City & location state
  const [cities, setCities] = useState<CityRecord[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Stores state
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);
  const [filterKind, setFilterKind] = useState<'all' | 'kendra' | 'pharmacy' | 'hospital'>('all');

  // Route state
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [showRouteSteps, setShowRouteSteps] = useState(false);

  // 1. Fetch cities on mount
  useEffect(() => {
    let active = true;
    const fetchCities = async () => {
      try {
        const res = await apiClient.getCities();
        if (active && res.length > 0) {
          setCities(res);
          setSelectedCityId(res[0].city_id);
        }
      } catch (err) {
        console.warn('Failed to load cities list:', err);
      }
    };
    fetchCities();
    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch stores whenever selectedCityId or userCoords changes
  useEffect(() => {
    if (!selectedCityId && !userCoords) return;

    let active = true;
    const fetchStores = async () => {
      setLoadingStores(true);
      setStoreError(null);
      setActiveRoute(null);
      setRouteError(null);

      try {
        const params = userCoords
          ? { lat: userCoords.lat, lng: userCoords.lng }
          : { city_id: selectedCityId };

        const data = await apiClient.getStores(params);
        if (active) {
          setStores(data);
          if (data.length > 0) {
            setSelectedStore(data[0]);
          } else {
            setSelectedStore(null);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setStoreError(
            err instanceof ApiClientError
              ? err.message
              : 'Failed to retrieve store locator records. Please check your network.'
          );
        }
      } finally {
        if (active) setLoadingStores(false);
      }
    };

    fetchStores();
    return () => {
      active = false;
    };
  }, [selectedCityId, userCoords]);

  // Geolocation trigger
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Please select your city manually.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission was denied. City selector remains fully usable.');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('Location request timed out. Please select your city manually.');
        } else {
          setGeoError('Unable to determine location. Please select your city manually.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  // Route calculation trigger
  const handleGetRoute = async (store: StoreRecord) => {
    setSelectedStore(store);
    setActiveRoute(null);
    setRouteError(null);
    setLoadingRoute(true);

    const fromLat = userCoords?.lat || (stores[0]?.lat ? stores[0].lat + 0.015 : store.lat - 0.015);
    const fromLng = userCoords?.lng || (stores[0]?.lng ? stores[0].lng - 0.015 : store.lng - 0.015);

    try {
      const routeRes = await apiClient.getRoute({
        from_lat: fromLat,
        from_lng: fromLng,
        to_lat: store.lat,
        to_lng: store.lng
      });
      setActiveRoute(routeRes);
      setShowRouteSteps(true);
    } catch (err: unknown) {
      setRouteError(
        err instanceof ApiClientError
          ? err.message
          : 'Driving route service is currently unavailable for this destination.'
      );
    } finally {
      setLoadingRoute(false);
    }
  };

  // Filtered stores
  const filteredStores = stores.filter((s) => {
    if (filterKind === 'all') return true;
    if (filterKind === 'kendra') return s.kind === 'kendra';
    if (filterKind === 'pharmacy') return s.kind === 'pharmacy';
    if (filterKind === 'hospital') return s.kind === 'clinic' || s.kind === 'hospital';
    return true;
  });

  const kendraCount = stores.filter((s) => s.kind === 'kendra').length;

  return (
    <section aria-labelledby="stores-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 id="stores-heading" className="card-title" style={{ fontSize: '1.4rem' }}>
          {t.storesTitle}
        </h2>
        <p className="card-desc">
          {t.storesSubtitle}
        </p>
      </div>

      {/* City & Geolocation Control Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="city-select-input" className="input-label">
              {t.selectCity}:
            </label>
            <select
              id="city-select-input"
              value={selectedCityId}
              onChange={(e) => {
                setSelectedCityId(e.target.value);
                setUserCoords(null); // Switch back to city mode
              }}
              className="input-field"
              style={{ minHeight: '46px' }}
            >
              {cities.map((c) => (
                <option key={c.city_id} value={c.city_id}>
                  {c.name}, {c.state}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleUseLocation}
            disabled={isLocating}
            className="btn-secondary"
            style={{ flex: '1 1 200px', minHeight: '46px' }}
          >
            <Compass size={18} />
            <span>{isLocating ? 'Locating…' : t.useLocation}</span>
          </button>
        </div>

        {/* Geolocation status / error banner */}
        {geoError && (
          <div
            role="status"
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.85rem',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
            <span>{geoError}</span>
          </div>
        )}

        {userCoords && (
          <div style={{ fontSize: '0.82rem', color: '#065f46', background: '#ecfdf5', padding: '6px 10px', borderRadius: '4px' }}>
            ✓ Using your current GPS coordinates. Displaying nearby Kendras by distance.
          </div>
        )}
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setFilterKind('all')}
          className={`status-badge ${filterKind === 'all' ? 'success' : 'neutral'}`}
          style={{ cursor: 'pointer', minHeight: '34px', padding: '6px 12px' }}
        >
          All Places ({stores.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterKind('kendra')}
          className={`status-badge ${filterKind === 'kendra' ? 'success' : 'neutral'}`}
          style={{ cursor: 'pointer', minHeight: '34px', padding: '6px 12px' }}
        >
          Jan Aushadhi Kendras Only ({kendraCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterKind('pharmacy')}
          className={`status-badge ${filterKind === 'pharmacy' ? 'success' : 'neutral'}`}
          style={{ cursor: 'pointer', minHeight: '34px', padding: '6px 12px' }}
        >
          Commercial Pharmacies
        </button>
        <button
          type="button"
          onClick={() => setFilterKind('hospital')}
          className={`status-badge ${filterKind === 'hospital' ? 'success' : 'neutral'}`}
          style={{ cursor: 'pointer', minHeight: '34px', padding: '6px 12px' }}
        >
          Hospitals/Clinics
        </button>
      </div>

      {/* Zero Kendras Notice */}
      {!loadingStores && kendraCount === 0 && (
        <div className="card" style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
          <strong style={{ color: '#92400e', display: 'block', marginBottom: '4px' }}>
            No Jan Aushadhi Kendras found in this area
          </strong>
          <p style={{ fontSize: '0.88rem', color: '#78350f' }}>
            Other medical stores and clinics are shown below for emergency reference. In accordance with policy, private commercial pharmacies are never claimed to be official Jan Aushadhi Kendras.
          </p>
        </div>
      )}

      {/* Active Driving Route Banner */}
      {activeRoute && selectedStore && (
        <div
          className="card"
          style={{
            background: '#ecfdf5',
            border: '2px solid var(--color-save-badge)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <NavIcon size={20} color="#047857" />
              <strong style={{ fontSize: '1.05rem', color: '#065f46' }}>
                Driving Route to {selectedStore.name}
              </strong>
            </div>
            <span className="status-badge success" style={{ fontSize: '0.75rem' }}>
              Profile: Driving ({activeRoute.provider.toUpperCase()})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '0.95rem', color: '#065f46', fontWeight: 700 }}>
            <span>Distance: {(activeRoute.distance_m / 1000).toFixed(1)} km</span>
            <span>•</span>
            <span>Est. Duration: {Math.round(activeRoute.duration_s / 60)} mins</span>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowRouteSteps(!showRouteSteps)}
              style={{
                background: 'none',
                border: 'none',
                color: '#047857',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{showRouteSteps ? 'Hide Navigation Steps' : 'Show Turn-by-Turn Steps'}</span>
              {showRouteSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showRouteSteps && activeRoute.steps && (
            <ol style={{ paddingLeft: '20px', fontSize: '0.85rem', color: '#065f46', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeRoute.steps.map((st: any, idx: number) => (
                <li key={idx}>
                  {typeof st === 'string' ? st : st.instruction || `Step ${idx + 1}`}
                  {st.distance_m ? ` (${st.distance_m}m)` : ''}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Route Error Banner */}
      {routeError && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.88rem',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={18} color="#b91c1c" style={{ flexShrink: 0 }} />
          <span>{routeError}</span>
        </div>
      )}

      {/* Lazy Loaded Leaflet Map */}
      <Suspense
        fallback={
          <div className="card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
            <p style={{ color: '#6b7280', fontSize: '0.92rem' }}>Loading map and OpenStreetMap tile layer…</p>
          </div>
        }
      >
        <LazyStoreMap
          stores={filteredStores}
          selectedStore={selectedStore}
          onSelectStore={handleGetRoute}
          userCoords={userCoords}
          activeRoute={activeRoute}
        />
      </Suspense>

      {/* List-First Results (Accessible for 360px phones & weak network) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 className="card-title" style={{ fontSize: '1.2rem', margin: '4px 0 0' }}>
          Stores &amp; Facilities ({filteredStores.length})
        </h3>

        {loadingStores ? (
          <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
            <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Loading nearby stores and Kendras…</p>
          </div>
        ) : storeError ? (
          <div className="card" role="alert" style={{ borderLeft: '4px solid #ef4444', background: 'var(--color-error-bg)' }}>
            <p style={{ color: '#991b1b', fontSize: '0.92rem' }}>{storeError}</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
            <p style={{ color: '#6b7280' }}>No places matching this filter in selected area.</p>
          </div>
        ) : (
          filteredStores.map((store, idx) => {
            const isKendra = store.kind === 'kendra';
            const isSelected = selectedStore?.name === store.name;

            return (
              <div
                key={idx}
                className="card"
                style={{
                  border: isSelected ? '2px solid var(--color-primary)' : isKendra ? '1.5px solid var(--color-save-badge)' : '1px solid var(--color-border)',
                  background: isSelected ? '#f8faf9' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                        {store.name}
                      </span>
                      <span
                        className={`status-badge ${isKendra ? 'success' : 'neutral'}`}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {isKendra ? 'Verified PMBJP Kendra' : store.kind.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', color: '#4b5563', marginTop: '4px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <MapPin size={16} color="#6b7280" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{store.address || 'Address on record'}</span>
                    </div>
                  </div>

                  {store.distance_m !== null && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '4px 8px', borderRadius: '4px' }}>
                      {(store.distance_m / 1000).toFixed(1)} km
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.82rem', color: '#4b5563' }}>
                  {store.hours && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} color="#047857" />
                      <span>{store.hours}</span>
                    </div>
                  )}

                  {store.contact && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={14} color="#1d4ed8" />
                      <a href={`tel:${store.contact}`} style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>
                        {store.contact}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Source: {store.source}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleGetRoute(store)}
                    disabled={loadingRoute && selectedStore?.name === store.name}
                    className="btn-secondary"
                    style={{ minHeight: '38px', padding: '4px 12px', fontSize: '0.85rem' }}
                  >
                    <NavIcon size={14} />
                    <span>{loadingRoute && selectedStore?.name === store.name ? 'Routing…' : 'Driving Route'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default StoresPage;
