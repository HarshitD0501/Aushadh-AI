/**
 * AushadhAi API Types
 * Strictly aligned with docs/API_CONTRACT.md
 */

export interface SourcedMoney {
  amount_paise: number;
  currency: 'INR' | string;
  unit: string;
  source_url: string;
  checked_on: string; // YYYY-MM-DD
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
}

export interface ServiceCapabilities {
  ocr: boolean;
  normalizer: boolean;
  stores: boolean;
  routes: boolean;
  whatsapp: boolean;
  calling: boolean;
}

export interface BrandReference {
  brand_id: string;
  name: string;
}

export interface SearchCandidate {
  medicine_id: string;
  matched_text: string;
  molecule_label: string;
  strength_label: string;
  form: string;
  release_type: string | null;
  pack_label: string;
  brands: BrandReference[];
  match_score: number;
  requires_confirmation: boolean;
}

export interface SearchResponse {
  query: string;
  candidates: SearchCandidate[];
}

export interface CompareItemRequest {
  medicine_id: string;
  brand_id: string | null;
  pack_count: number;
}

export interface CompareRequest {
  items: CompareItemRequest[];
}

export interface ComparisonItem {
  medicine_id: string;
  pmbjp_product_code: string | null;
  matched_text: string;
  molecule_label: string;
  strength_label: string;
  form: string;
  release_type: string | null;
  pack_label: string;
  brand_name: string | null;
  market_price: SourcedMoney | null;
  nppa_ceiling_price: SourcedMoney | null;
  pmbjp_price: SourcedMoney | null;
  saving_paise: number | null;
  saving_percent: number | null;
  comparison_basis: string | null;
  excluded_reason: string | null;
}

export interface ComparisonTotals {
  comparable_item_count: number;
  incomplete_item_count: number;
  market_total_paise: number | null;
  pmbjp_total_paise: number | null;
  saving_total_paise: number | null;
  saving_percent: number | null;
}

export interface CompareResponse {
  items: ComparisonItem[];
  totals: ComparisonTotals;
}

export interface OcrSuggestion {
  observed_text: string;
  query_tokens: string[];
  candidate_medicine_ids: string[];
  status: 'unconfirmed';
}

export interface OcrResponse {
  raw_text: string;
  normalization_provider: 'gemma' | 'groq' | 'none';
  suggestions: OcrSuggestion[];
  warnings: string[];
}

export interface CityRecord {
  city_id: string;
  name: string;
  state: string;
}

export type StoreKind = 'kendra' | 'pharmacy' | 'clinic' | 'hospital';

export interface StoreRecord {
  kind: StoreKind;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  contact: string | null;
  hours: string | null;
  source: string;
}

export interface RouteResponse {
  distance_m: number;
  duration_s: number;
  geometry_geojson: unknown;
  steps: unknown[];
  profile: 'driving';
  provider: 'osrm';
}

export interface ReminderCreateRequest {
  client_report_id: string;
  medicine_id: string;
  confirmed_instruction: string;
  time_local: string; // HH:mm
  timezone: 'Asia/Kolkata';
  end_date: string; // YYYY-MM-DD
  recipient_consent: true;
  idempotency_key: string;
}

export interface ReminderCreateResponse {
  reminder_id: string;
  management_token: string;
  status: 'scheduled';
  next_due_at: string;
}

export type ReminderStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface ReminderStatusResponse {
  reminder_id: string;
  status: ReminderStatus;
  last_attempt_at: string | null;
  error: string | null;
}

export interface CheckupDetails {
  date_local: string;
  time_local: string;
  place: string;
  doctor: string | null;
}

export interface CallCreateRequest {
  client_report_id: string;
  checkup: CheckupDetails;
  checkup_confirmed: true;
  idempotency_key: string;
}

export interface CallCreateResponse {
  call_id: string;
  management_token: string;
  status: 'requested';
}

export type CallStatus = 'requested' | 'ringing' | 'answered' | 'completed' | 'failed';

export interface CallStatusResponse {
  call_id: string;
  status: CallStatus;
  last_attempt_at: string | null;
  error: string | null;
}

export interface PublicCatalogueRecord {
  medicine_id: string;
  name: string;
  molecule_label: string;
  strength_label: string;
  form: string;
}

export interface PublicCatalogueResponse {
  version: string;
  checked_on: string;
  records: PublicCatalogueRecord[];
}
