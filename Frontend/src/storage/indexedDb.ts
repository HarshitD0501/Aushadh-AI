/**
 * AushadhAi IndexedDB Storage Layer
 * Local-first client persistence. No personal images, tokens or unreviewed health data.
 */

import type { PublicCatalogueRecord, PublicCatalogueResponse } from '../api/types';

const DB_NAME = 'aushadh_ai_db';
const DB_VERSION = 1;

export interface CachedCatalogueData {
  version: string;
  checked_on: string;
  etag: string | null;
  cached_at: string;
  records: PublicCatalogueRecord[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('catalogue_cache')) {
        db.createObjectStore('catalogue_cache', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('prescriptions')) {
        db.createObjectStore('prescriptions', { keyPath: 'report_id' });
      }

      if (!db.objectStoreNames.contains('action_tokens')) {
        db.createObjectStore('action_tokens', { keyPath: 'action_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCatalogueCache(
  data: PublicCatalogueResponse,
  etag: string | null
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('catalogue_cache', 'readwrite');
      const store = tx.objectStore('catalogue_cache');
      const payload: CachedCatalogueData & { id: string } = {
        id: 'public_catalogue',
        version: data.version,
        checked_on: data.checked_on,
        etag: etag ?? null,
        cached_at: new Date().toISOString(),
        records: data.records
      };
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save public catalogue cache in IndexedDB:', err);
  }
}

export async function getCatalogueCache(): Promise<CachedCatalogueData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('catalogue_cache', 'readonly');
      const store = tx.objectStore('catalogue_cache');
      const req = store.get('public_catalogue');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve public catalogue cache from IndexedDB:', err);
    return null;
  }
}

export async function searchOfflineCatalogue(query: string): Promise<PublicCatalogueRecord[]> {
  const cached = await getCatalogueCache();
  if (!cached || !cached.records || !query.trim()) {
    return [];
  }
  const clean = query.trim().toLowerCase();
  return cached.records
    .filter(
      (r) =>
        r.name.toLowerCase().includes(clean) ||
        r.molecule_label.toLowerCase().includes(clean)
    )
    .slice(0, 8);
}
