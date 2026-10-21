/**
 * AushadhAi Typed API Client
 * Uses docs/API_CONTRACT.md endpoints prefixed with /api/v1
 * Supports clearly marked development fixtures when backend is unreachable during dev.
 */

import type {
  ApiError,
  CallCreateRequest,
  CallCreateResponse,
  CallStatusResponse,
  CityRecord,
  CompareRequest,
  CompareResponse,
  OcrResponse,
  PublicCatalogueResponse,
  ReminderCreateRequest,
  ReminderCreateResponse,
  ReminderStatusResponse,
  RouteResponse,
  SearchResponse,
  ServiceCapabilities,
  StoreRecord
} from './types';
import {
  DEV_FIXTURE_CATALOGUE,
  getFixtureCompare,
  getFixtureOcr,
  getFixtureSearch
} from './fixtures';

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, message: string, code = 'API_ERROR', requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  public devFixturesEnabled: boolean = import.meta.env.DEV;
  public lastRequestUsedFixture: boolean = false;

  constructor(baseUrl?: string) {
    const configured = baseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    this.baseUrl = configured.replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const mergedSignal = options.signal || controller.signal;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: mergedSignal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errPayload: ApiError | null = null;
        try {
          errPayload = await response.json();
        } catch {
          // Response not JSON
        }

        const code = errPayload?.error?.code || `HTTP_${response.status}`;
        const message =
          errPayload?.error?.message ||
          `Request failed with HTTP status ${response.status} (${response.statusText})`;
        const requestId = errPayload?.error?.request_id;

        throw new ApiClientError(response.status, message, code, requestId);
      }

      if (response.status === 204) {
        return {} as T;
      }

      this.lastRequestUsedFixture = false;
      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiClientError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiClientError(408, 'Request timed out or was cancelled', 'TIMEOUT_ERROR');
      }
      throw new ApiClientError(
        503,
        'Cannot reach backend server. Please verify network connection.',
        'NETWORK_ERROR'
      );
    }
  }

  // System & capabilities
  async getHealth(signal?: AbortSignal): Promise<{ status: string }> {
    return this.request<{ status: string }>('/api/v1/health', { signal });
  }

  async getCapabilities(signal?: AbortSignal): Promise<ServiceCapabilities> {
    return this.request<ServiceCapabilities>('/api/v1/capabilities', { signal });
  }

  async getPublicCatalogue(
    etag?: string | null,
    signal?: AbortSignal
  ): Promise<{ data: PublicCatalogueResponse; etag: string | null; isFixture?: boolean }> {
    try {
      const headers: Record<string, string> = {};
      if (etag) {
        headers['If-None-Match'] = etag;
      }
      const url = `${this.baseUrl}/api/v1/catalogue/public`;
      const res = await fetch(url, { headers, signal });
      if (res.status === 304) {
        return { data: { version: '', checked_on: '', records: [] }, etag: etag ?? null };
      }
      if (!res.ok) {
        throw new ApiClientError(res.status, 'Failed to fetch public catalogue', 'CATALOGUE_ERROR');
      }
      const data = await res.json();
      this.lastRequestUsedFixture = false;
      return { data, etag: res.headers.get('ETag') ?? null };
    } catch (err) {
      if (this.devFixturesEnabled) {
        this.lastRequestUsedFixture = true;
        return { data: DEV_FIXTURE_CATALOGUE, etag: 'fixture-etag-v1', isFixture: true };
      }
      throw err;
    }
  }

  // Search & compare
  async search(
    query: string,
    limit = 8,
    signal?: AbortSignal
  ): Promise<SearchResponse & { isFixture?: boolean }> {
    const encoded = encodeURIComponent(query.trim());
    try {
      const res = await this.request<SearchResponse>(
        `/api/v1/search?q=${encoded}&limit=${limit}`,
        { signal }
      );
      this.lastRequestUsedFixture = false;
      return res;
    } catch (err) {
      if (this.devFixturesEnabled && err instanceof ApiClientError && err.code === 'NETWORK_ERROR') {
        this.lastRequestUsedFixture = true;
        const fixtureRes = getFixtureSearch(query);
        return { ...fixtureRes, isFixture: true };
      }
      throw err;
    }
  }

  async compare(
    request: CompareRequest,
    signal?: AbortSignal
  ): Promise<CompareResponse & { isFixture?: boolean }> {
    try {
      const res = await this.request<CompareResponse>('/api/v1/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal
      });
      this.lastRequestUsedFixture = false;
      return res;
    } catch (err) {
      if (this.devFixturesEnabled && err instanceof ApiClientError && err.code === 'NETWORK_ERROR') {
        this.lastRequestUsedFixture = true;
        const fixtureRes = getFixtureCompare(request);
        return { ...fixtureRes, isFixture: true };
      }
      throw err;
    }
  }

  // OCR
  async processOcr(
    imageFile: File | Blob,
    signal?: AbortSignal
  ): Promise<OcrResponse & { isFixture?: boolean }> {
    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const res = await this.request<OcrResponse>('/api/v1/ocr', {
        method: 'POST',
        body: formData,
        signal
      });
      this.lastRequestUsedFixture = false;
      return res;
    } catch (err) {
      if (this.devFixturesEnabled && err instanceof ApiClientError && err.code === 'NETWORK_ERROR') {
        this.lastRequestUsedFixture = true;
        const fixtureRes = getFixtureOcr((imageFile as File)?.name);
        return { ...fixtureRes, isFixture: true };
      }
      throw err;
    }
  }

  // Stores & routes
  async getCities(signal?: AbortSignal): Promise<CityRecord[]> {
    return this.request<CityRecord[]>('/api/v1/cities', { signal });
  }

  async getStores(
    params: { city_id?: string; lat?: number; lng?: number },
    signal?: AbortSignal
  ): Promise<StoreRecord[]> {
    const query = new URLSearchParams();
    if (params.city_id) query.set('city_id', params.city_id);
    if (typeof params.lat === 'number') query.set('lat', params.lat.toString());
    if (typeof params.lng === 'number') query.set('lng', params.lng.toString());

    return this.request<StoreRecord[]>(`/api/v1/stores?${query.toString()}`, { signal });
  }

  async getRoute(
    params: { from_lat: number; from_lng: number; to_lat: number; to_lng: number },
    signal?: AbortSignal
  ): Promise<RouteResponse> {
    const query = new URLSearchParams({
      from_lat: params.from_lat.toString(),
      from_lng: params.from_lng.toString(),
      to_lat: params.to_lat.toString(),
      to_lng: params.to_lng.toString(),
      mode: 'driving'
    });
    return this.request<RouteResponse>(`/api/v1/routes?${query.toString()}`, { signal });
  }

  // Reminders
  async createReminder(
    request: ReminderCreateRequest,
    signal?: AbortSignal
  ): Promise<ReminderCreateResponse> {
    return this.request<ReminderCreateResponse>('/api/v1/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal
    });
  }

  async getReminderStatus(
    reminderId: string,
    managementToken: string,
    signal?: AbortSignal
  ): Promise<ReminderStatusResponse> {
    return this.request<ReminderStatusResponse>(
      `/api/v1/reminders/${encodeURIComponent(reminderId)}`,
      {
        headers: { Authorization: `Bearer ${managementToken}` },
        signal
      }
    );
  }

  async cancelReminder(
    reminderId: string,
    managementToken: string,
    signal?: AbortSignal
  ): Promise<{ status: 'cancelled' }> {
    return this.request<{ status: 'cancelled' }>(
      `/api/v1/reminders/${encodeURIComponent(reminderId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managementToken}` },
        signal
      }
    );
  }

  // Outbound checkup call
  async createCall(
    request: CallCreateRequest,
    signal?: AbortSignal
  ): Promise<CallCreateResponse> {
    return this.request<CallCreateResponse>('/api/v1/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal
    });
  }

  async getCallStatus(
    callId: string,
    managementToken: string,
    signal?: AbortSignal
  ): Promise<CallStatusResponse> {
    return this.request<CallStatusResponse>(
      `/api/v1/calls/${encodeURIComponent(callId)}`,
      {
        headers: { Authorization: `Bearer ${managementToken}` },
        signal
      }
    );
  }
}

export const apiClient = new ApiClient();
