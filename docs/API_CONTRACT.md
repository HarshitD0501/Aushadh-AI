# Version 1 integration contract

**Status:** Contract for the first implementation, not an existing service. Backend owns server endpoints; Frontend owns browser persistence; Agent owns the LiveKit worker. Changes to public fields require a contract PR before implementation on another branch. All examples below use identifiers and `null` values; they are **not** medicine or price claims.

## Shared conventions

- Prefix public HTTP routes with `/api/v1`. JSON uses `snake_case`; IDs are opaque strings; dates are ISO `YYYY-MM-DD`; timestamps are ISO 8601 UTC; monetary values are **integer paise** to avoid floating-point errors. UI formats ₹ and percentage after reading values.
- Every sourced money field is either `{ "amount_paise": 0, "currency": "INR", "unit": "pack", "source_url": "...", "checked_on": "YYYY-MM-DD" }` or `null`. `0` is valid only when a cited source actually states zero; unknown is always `null`.
- Common error: `{ "error": { "code": "VALIDATION_ERROR", "message": "Readable message", "request_id": "opaque-id" } }`. Use appropriate HTTP status: 400 invalid input, 404 unknown ID, 409 conflict/duplicate, 413 image too large, 422 incompatible medicine/price pair, 429 quota, 503 upstream unavailable. Do not return raw provider errors or secrets.
- `GET /api/v1/health` returns service readiness; `GET /api/v1/capabilities` returns booleans for `ocr`, `normalizer`, `stores`, `routes`, `whatsapp` and `calling`. A disabled capability must not break search.
- `GET /api/v1/catalogue/public` returns `{ version, checked_on, records }` containing only public search labels/IDs for offline suggestions, with an ETag. Frontend may cache one version and mark it stale offline; a new price comparison still requires the backend. Do not include private reports, recipient or schedule data.
- Public endpoints have explicit origin allowlist, input caps, bounded timeouts and rate limits. Browser local report IDs are not authentication credentials. The phone recipient is never in any public request or response. Reminder/call management tokens are random secrets returned once, stored only as hashes on the server, sent in `Authorization: Bearer <token>` for status/cancel requests, and never put in a URL or log.

## Medicine model

`medicine_id` identifies one verified PMBJP product/formulation with **exact molecule composition, strength, dosage form, release type and pack basis**. A `brand_id` identifies a verified, comparable branded product. A search result may exist without a brand price; that is not a valid savings comparison. See [`DATA_POLICY.md`](DATA_POLICY.md) for the dataset record and review rules.

### `GET /api/v1/search?q=...&limit=8`

Return up to 8 ranked, dataset-backed suggestions for typo-tolerant brand or molecule input. Ignore blank queries; cap query length and `limit`; use RapidFuzz WRatio threshold 75 **only to propose candidates**. Ranking must never silently decide a strength or substitute a formulation.

```json
{
  "query": "user text",
  "candidates": [
    {
      "medicine_id": "catalogue-id",
      "matched_text": "verified name",
      "molecule_label": "verified molecule text",
      "strength_label": "verified strength text",
      "form": "verified form",
      "release_type": "verified release type or null",
      "pack_label": "verified pack label",
      "brands": [{ "brand_id": "brand-id", "name": "verified brand" }],
      "match_score": 84,
      "requires_confirmation": true
    }
  ]
}
```

`match_score` is search ranking only, never a clinical confidence score. If there are multiple strengths or forms, return separate selectable candidates. No match returns `candidates: []` with HTTP 200.

### `POST /api/v1/compare`

Request: `{ "items": [{ "medicine_id": "...", "brand_id": "...", "pack_count": 1 }] }`. `brand_id` may be `null` when the user searches by molecule and only a PMBJP price can be shown. `pack_count` is a positive integer with a server cap. Reject mismatched brand/form/strength/pack relationships; never calculate against a vaguely similar row.

Response contains each `medicine_id`, confirmed display fields, PMBJP product code, `market_price`, `nppa_ceiling_price`, `pmbjp_price` (each sourced object or `null`), `saving_paise` and `saving_percent` (both `null` unless a comparable market/PMBJP pair exists), `comparison_basis`, and `excluded_reason` for incomplete rows. `totals` sums only complete comparable rows and contains `comparable_item_count`, `incomplete_item_count`, `market_total_paise`, `pmbjp_total_paise`, `saving_total_paise`, `saving_percent`. The response labels these as **estimated potential savings**. NPPA is shown as a separate regulatory reference and is never substituted for an absent market MRP.

## OCR and confirmation

### `POST /api/v1/ocr`

Multipart `image` only. Backend sets a documented max upload size, MIME allowlist, pixel limit, worker concurrency and timeout. Process image transiently; do not retain it or log extracted health text. Return:

```json
{
  "raw_text": "OCR text or empty string",
  "normalization_provider": "gemma|groq|none",
  "suggestions": [
    {
      "observed_text": "text actually observed",
      "query_tokens": ["possible", "name"],
      "candidate_medicine_ids": ["catalogue-id"],
      "status": "unconfirmed"
    }
  ],
  "warnings": ["Low quality image; confirm manually"]
}
```

Models may clean query text and extract explicitly observed tokens; they cannot create medicine IDs, compositions, strengths, doses or prices. The backend resolves IDs through the catalogue. If Tesseract or both normalizers fail, return warnings and a recoverable result when possible; the frontend keeps manual search available. For a wholly failed image request, use a clear 422/503 error and manual-search action.

There is no `POST /prescriptions` or `GET /history` API. After explicit confirmation, Frontend stores a versioned report summary in browser IndexedDB under a local UUID. A report stores selected IDs, user-entered quantity and reminder/checkup text, and a dated comparison snapshot for reprint; it does **not** store the source image or raw OCR. Recompare when online to refresh price information. Clearing browser storage removes reports. No login or cross-device sync.

## Stores and routes

- `GET /api/v1/cities` returns curated `{ city_id, name, state }` choices.
- `GET /api/v1/stores?city_id=...` or `?lat=...&lng=...` returns separate place records with `kind: "kendra" | "pharmacy" | "clinic" | "hospital"`, `source`, coordinates, address/hours/contact only when known, and distance only when origin coordinates exist. `kendra` requires a curated verified source; OSM-derived generic pharmacies must retain their actual kind.
- `GET /api/v1/routes?from_lat=...&from_lng=...&to_lat=...&to_lng=...&mode=driving` returns `{ "distance_m": 0, "duration_s": 0, "geometry_geojson": { ... }, "steps": [...], "profile": "driving", "provider": "osrm" }` or 503/404 when unavailable. Add `walking` only after a real walking-profile routing service is configured and tested. Coordinates have range validation and a bounded route request.

The frontend loads the map only on `/stores`, keeps list results accessible, shows attribution, and does not prefetch OSM tiles for offline use.

## Real WhatsApp reminders

### `POST /api/v1/reminders`

Create **one daily time** per request. UI may create multiple records for morning/lunch/evening after the user explicitly confirms each instruction.

```json
{
  "client_report_id": "local-uuid",
  "medicine_id": "catalogue-id",
  "confirmed_instruction": "user-entered text",
  "time_local": "09:00",
  "timezone": "Asia/Kolkata",
  "end_date": "YYYY-MM-DD",
  "recipient_consent": true,
  "idempotency_key": "client-generated-uuid"
}
```

User chooses the daily time **and end date** (maximum 30 days from creation); no model or OCR supplies the schedule, and no default course duration is invented. Backend targets only `DEMO_RECIPIENT_E164`, checks consent and limits, stores the schedule in Postgres, and sends an approved Meta utility template when due. Return `{ reminder_id, management_token, status: "scheduled", next_due_at }`. `GET /api/v1/reminders/{id}` returns `scheduled|sent|delivered|failed|cancelled`, last attempt and provider-safe error. `DELETE /api/v1/reminders/{id}` cancels future sends. Both requests require the management token. Frontend stores the ID and token with the local report. A Meta accepted/send response is `sent`, not `delivered`; delivery requires webhook evidence. A verified inbound `STOP` from the fixed number cancels its future schedules if local browser data has been cleared.

`POST /api/v1/internal/reminders/dispatch` is **server-to-server only**, protected by `REMINDER_CRON_SECRET`. cron-job.org may invoke it once per minute. It atomically claims due rows and uses an idempotency key per reminder/date/time to prevent duplicate sends after retry or cold start. Missing minute or failed delivery is visible; do not promise exact-minute delivery on free hosting.

`GET /api/v1/webhooks/meta` completes Meta's configured verification challenge. `POST /api/v1/webhooks/meta` validates the provider signature before applying message delivery statuses or a fixed-recipient `STOP`; deduplicate webhook events. Neither route returns health data to the caller.

## Immediate outbound checkup call

### `POST /api/v1/calls`

```json
{
  "client_report_id": "local-uuid",
  "checkup": {
    "date_local": "YYYY-MM-DD",
    "time_local": "14:30",
    "place": "user-confirmed place",
    "doctor": "user-confirmed name or null"
  },
  "checkup_confirmed": true,
  "idempotency_key": "client-generated-uuid"
}
```

Backend validates confirmed details, fixed test recipient, enabled provider, per-IP/per-day quota and duplicate-click key; it creates a LiveKit/SIP call context. Return `{ call_id, management_token, status: "requested" }`. `GET /api/v1/calls/{id}` requires the management token and reports `requested|ringing|answered|completed|failed` from real events. No phone field in browser and no scheduled two-day-before call.

Private agent routes require `AGENT_BACKEND_TOKEN`: `GET /api/v1/internal/calls/{id}/context` returns the confirmed checkup and selected catalogue IDs; `GET /api/v1/internal/medicines/{id}` returns only reviewed molecule/usage facts and source metadata; `POST /api/v1/internal/calls/{id}/events` accepts validated lifecycle events. Agent may use the public store lookup for a confirmed location but has no write tool for medicine/reminder facts. Call context expires within 24 hours after terminal status.

## Integration order

1. Backend publishes search/compare and a tiny **verified** fixture; Frontend connects Search.
2. Backend publishes OCR and stores/routes; Frontend connects Scan and Stores.
3. Frontend implements local history/print; Backend publishes reminder/call endpoints; Agent consumes private call context and read-only facts.
4. Run a real template/webhook test and real Twilio SIP call before describing either as working. Document any unavailable provider in `GET /capabilities` and the demo runbook.
