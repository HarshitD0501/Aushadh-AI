/**
 * AushadhAi IndexedDB Storage Layer
 * Local-first client persistence. No personal images, tokens or unreviewed health data.
 */

import type {
  ComparisonItem,
  ComparisonTotals,
  PublicCatalogueRecord,
  PublicCatalogueResponse,
  SourcedMoney
} from '../api/types';

const DB_NAME = 'aushadh_ai_db';
const DB_VERSION = 1;

export interface CachedCatalogueData {
  version: string;
  checked_on: string;
  etag: string | null;
  cached_at: string;
  records: PublicCatalogueRecord[];
}

export interface ConfirmedPrescriptionItem {
  medicine_id: string;
  pmbjp_product_code: string | null;
  brand_id: string | null;
  brand_name: string | null;
  matched_text: string;
  molecule_label: string;
  strength_label: string;
  form: string;
  release_type: string | null;
  pack_label: string;
  pack_count: number;
  confirmed_instruction?: string;
  comparison_snapshot: {
    market_price: SourcedMoney | null;
    pmbjp_price: SourcedMoney | null;
    nppa_ceiling_price: SourcedMoney | null;
    saving_paise: number | null;
    saving_percent: number | null;
    comparison_basis: string | null;
    excluded_reason: string | null;
  };
}

export interface StoredCheckup {
  date_local: string;
  time_local: string;
  place: string;
  doctor: string | null;
  confirmed: boolean;
}

export interface StoredActionToken {
  action_id: string;
  report_id: string;
  type: 'reminder' | 'call';
  token: string;
  status: string;
  created_at: string;
}

export interface PrescriptionReport {
  report_id: string;
  created_at: string;
  updated_at: string;
  items: ConfirmedPrescriptionItem[];
  totals_snapshot: ComparisonTotals;
  checkup?: StoredCheckup | null;
  reminders?: Array<{ reminder_id: string; medicine_id: string; time_local: string; status: string }>;
  calls?: Array<{ call_id: string; status: string }>;
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

// Public catalogue cache functions
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

// Prescription report functions
export async function savePrescriptionReport(report: PrescriptionReport): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('prescriptions', 'readwrite');
    const store = tx.objectStore('prescriptions');
    const req = store.put(report);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPrescriptionReport(reportId: string): Promise<PrescriptionReport | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('prescriptions', 'readonly');
    const store = tx.objectStore('prescriptions');
    const req = store.get(reportId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPrescriptionReports(): Promise<PrescriptionReport[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('prescriptions', 'readonly');
    const store = tx.objectStore('prescriptions');
    const req = store.getAll();
    req.onsuccess = () => {
      const reports = (req.result || []) as PrescriptionReport[];
      // Sort newest first
      reports.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      resolve(reports);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePrescriptionReport(reportId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('prescriptions', 'readwrite');
    const store = tx.objectStore('prescriptions');
    const req = store.delete(reportId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function computeReportTotals(items: ConfirmedPrescriptionItem[]): ComparisonTotals {
  const comparable = items.filter(
    (item) => item.comparison_snapshot.saving_paise !== null && item.comparison_snapshot.saving_paise !== undefined
  );
  const incomplete = items.filter(
    (item) => item.comparison_snapshot.saving_paise === null || item.comparison_snapshot.saving_paise === undefined
  );

  let marketTotalPaise = 0;
  let pmbjpTotalPaise = 0;

  for (const item of comparable) {
    if (item.comparison_snapshot.market_price) {
      marketTotalPaise += item.comparison_snapshot.market_price.amount_paise * item.pack_count;
    }
    if (item.comparison_snapshot.pmbjp_price) {
      pmbjpTotalPaise += item.comparison_snapshot.pmbjp_price.amount_paise * item.pack_count;
    }
  }

  const savingTotalPaise = marketTotalPaise - pmbjpTotalPaise;
  const savingPercent =
    marketTotalPaise > 0 ? Math.round((savingTotalPaise / marketTotalPaise) * 100) : null;

  return {
    comparable_item_count: comparable.length,
    incomplete_item_count: incomplete.length,
    market_total_paise: comparable.length > 0 ? marketTotalPaise : null,
    pmbjp_total_paise: comparable.length > 0 ? pmbjpTotalPaise : null,
    saving_total_paise: comparable.length > 0 ? savingTotalPaise : null,
    saving_percent: savingPercent
  };
}

export async function addOrUpdateReportWithItem(
  item: ComparisonItem,
  packCount: number,
  existingReportId?: string,
  checkup?: StoredCheckup | null
): Promise<string> {
  const reportId = existingReportId || `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  let existing = await getPrescriptionReport(reportId);

  const confirmedItem: ConfirmedPrescriptionItem = {
    medicine_id: item.medicine_id,
    pmbjp_product_code: item.pmbjp_product_code,
    brand_id: null,
    brand_name: item.brand_name,
    matched_text: item.matched_text,
    molecule_label: item.molecule_label,
    strength_label: item.strength_label,
    form: item.form,
    release_type: item.release_type,
    pack_label: item.pack_label,
    pack_count: packCount,
    comparison_snapshot: {
      market_price: item.market_price,
      pmbjp_price: item.pmbjp_price,
      nppa_ceiling_price: item.nppa_ceiling_price,
      saving_paise: item.saving_paise,
      saving_percent: item.saving_percent,
      comparison_basis: item.comparison_basis,
      excluded_reason: item.excluded_reason
    }
  };

  if (!existing) {
    const items = [confirmedItem];
    const totals = computeReportTotals(items);
    const newReport: PrescriptionReport = {
      report_id: reportId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items,
      totals_snapshot: totals,
      checkup: checkup || null
    };
    await savePrescriptionReport(newReport);
  } else {
    // If medicine already in list, update pack count
    const idx = existing.items.findIndex((i) => i.medicine_id === item.medicine_id);
    if (idx >= 0) {
      existing.items[idx].pack_count += packCount;
    } else {
      existing.items.push(confirmedItem);
    }
    existing.updated_at = new Date().toISOString();
    existing.totals_snapshot = computeReportTotals(existing.items);
    if (checkup) existing.checkup = checkup;
    await savePrescriptionReport(existing);
  }

  return reportId;
}

// Action tokens management (for Phase F6)
export async function saveActionToken(tokenRecord: StoredActionToken): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_tokens', 'readwrite');
    const store = tx.objectStore('action_tokens');
    const req = store.put(tokenRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getActionToken(actionId: string): Promise<StoredActionToken | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_tokens', 'readonly');
    const store = tx.objectStore('action_tokens');
    const req = store.get(actionId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
