import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StoreRecord, RouteResponse } from '../api/types';

interface LazyStoreMapProps {
  stores: StoreRecord[];
  selectedStore: StoreRecord | null;
  onSelectStore: (store: StoreRecord) => void;
  userCoords: { lat: number; lng: number } | null;
  activeRoute: RouteResponse | null;
}

export const LazyStoreMap: React.FC<LazyStoreMapProps> = ({
  stores,
  selectedStore,
  onSelectStore,
  userCoords,
  activeRoute
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = userCoords?.lat || (stores[0]?.lat ?? 28.6139);
    const initialLng = userCoords?.lng || (stores[0]?.lng ?? 77.2090);

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true
    });

    // Mandatory OSM TileLayer with official attribution
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // Update markers when stores, selection, or user coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    // 1. User Location Marker
    if (userCoords) {
      const userIcon = L.divIcon({
        className: 'user-marker-pin',
        html: `<div style="background: #2563eb; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const userMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .bindPopup('<strong>Your Current Location</strong>');
      layer.addLayer(userMarker);
      bounds.extend([userCoords.lat, userCoords.lng]);
    }

    // 2. Store Markers
    stores.forEach((store) => {
      const isSelected = selectedStore?.name === store.name;
      const isKendra = store.kind === 'kendra';

      const color = isKendra ? '#047857' : store.kind === 'hospital' ? '#7c3aed' : '#2563eb';
      const label = isKendra ? 'PMBJP' : store.kind.toUpperCase();

      const customIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="background: ${color}; color: #ffffff; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: 800; border: 2px solid ${isSelected ? '#f59e0b' : '#ffffff'}; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; cursor: pointer; text-align: center;">
            ${label}
          </div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 24]
      });

      const marker = L.marker([store.lat, store.lng], { icon: customIcon });

      marker.on('click', () => {
        onSelectStore(store);
      });

      marker.bindPopup(`
        <div style="padding: 2px;">
          <strong style="color: ${color}; font-size: 13px;">${store.name}</strong><br/>
          <span style="font-size: 11px; color: #4b5563;">${store.address || ''}</span><br/>
          ${store.hours ? `<span style="font-size: 11px; color: #047857;">Hours: ${store.hours}</span><br/>` : ''}
          ${store.contact ? `<span style="font-size: 11px;">Tel: <a href="tel:${store.contact}">${store.contact}</a></span>` : ''}
        </div>
      `);

      layer.addLayer(marker);
      bounds.extend([store.lat, store.lng]);
    });

    // 3. Draw Route Polyline if present
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (activeRoute && activeRoute.geometry_geojson) {
      const geo = activeRoute.geometry_geojson as { type?: string; coordinates?: number[][] };
      if (geo.coordinates && Array.isArray(geo.coordinates)) {
        // GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
        const latLngs: L.LatLngExpression[] = geo.coordinates.map((coord) => [coord[1], coord[0]]);
        const polyline = L.polyline(latLngs, {
          color: '#059669',
          weight: 5,
          opacity: 0.85,
          dashArray: '1, 6'
        }).addTo(map);

        routeLayerRef.current = polyline;
        bounds.extend(polyline.getBounds());
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [stores, selectedStore, userCoords, activeRoute, onSelectStore]);

  return (
    <div
      style={{
        border: '2px solid var(--color-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}
    >
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '340px',
          background: '#e5e7eb'
        }}
        role="region"
        aria-label="Interactive Jan Aushadhi and Pharmacy Map"
      />
      <div
        style={{
          background: '#f8faf9',
          padding: '6px 12px',
          fontSize: '0.75rem',
          color: '#4b5563',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '4px'
        }}
      >
        <span>
          Legend: <strong style={{ color: '#047857' }}>■ PMBJP Kendra</strong> • <strong style={{ color: '#2563eb' }}>■ Pharmacy</strong> • <strong style={{ color: '#7c3aed' }}>■ Hospital</strong>
        </span>
        <span>Tile cache policy: Never stored offline.</span>
      </div>
    </div>
  );
};

export default LazyStoreMap;
