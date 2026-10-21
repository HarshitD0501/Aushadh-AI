# Backend owner: deterministic API and integrations

**Status:** B0 API foundation exists. The medicine JSON and later integrations have not been created. Work in this folder. Read [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md), [`../docs/DATA_POLICY.md`](../docs/DATA_POLICY.md), and [`../CONTRIBUTING.md`](../CONTRIBUTING.md) first. Search/price safety is the core milestone; integrations follow it.

## Run the B0 foundation

Python 3.11+ is required. From this `backend` directory:

```powershell
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

The API serves `GET /api/v1/health`, `GET /api/v1/capabilities`, and `/openapi.json`. Run checks with `uv run --extra dev python -m unittest discover -s tests -v`. If you do not use uv, create a virtual environment and install `pip install -e ".[dev]"` before running the same commands. Copy `.env.example` to an untracked `.env` for local settings. `APP_ORIGIN` must match the frontend origin exactly; `DATABASE_URL` is optional until the persistence phase. Unimplemented capabilities return `false`.

## Stack and module boundaries

Use Python, FastAPI, Pydantic, RapidFuzz, Pillow/Tesseract, PostgreSQL on Neon, and a small migration layer. Load and index the curated JSON catalogue once at startup so normal search does not wait for DB or an LLM. Keep external provider clients behind interfaces with timeouts and test doubles. The Render deployment must include the Tesseract binary; a container is likely the simplest reproducible path, but verify Render's current build requirements in B8.

Suggested code ownership inside `backend`: `app/catalogue`, `app/search`, `app/compare`, `app/ocr`, `app/normalization`, `app/stores`, `app/reminders`, `app/telephony`, `app/api`, `data`, and `tests`. These are grouping hints, not an instruction to build everything in B0.

No login. Browser reports stay in IndexedDB. Backend stores only schedules, delivery attempts and transient call context needed for real integrations. The fixed demo recipient is `DEMO_RECIPIENT_E164` in server environment; browser requests cannot choose a phone number. Return unguessable management tokens for reminder/call status, store their hashes, and enforce fixed-recipient, per-IP/per-day and global provider-spend quotas.

## Endpoint ownership

Implement the exact contracts in [`API_CONTRACT.md`](../docs/API_CONTRACT.md): `/api/v1/health`, `/capabilities`, `/catalogue/public`, `/search`, `/compare`, `/ocr`, `/cities`, `/stores`, `/routes`, `/reminders`, `/calls`, Meta webhooks, and protected internal dispatch/read-only endpoints. Maintain JSON/OpenAPI examples and consistent errors. Do not implement backend `/history` or login; frontend owns local history.

## Phase sequence: test, commit, then continue

### B0 — API foundation and safe configuration

Create the installable FastAPI project, health/capabilities routes, Pydantic settings, typed error envelope, request IDs, origin allowlist, input caps, log redaction, tests and `.env.example`. Configure local PostgreSQL/Neon connection but do not require it for catalogue search. Keep a single source of truth for URLs and timeouts.

**Check:** fresh-clone setup runs, health endpoint and OpenAPI load, invalid CORS/input has an honest error, no env secret appears in logs or Git. **Commit now:** `chore(backend): scaffold API configuration and health checks`.

### B1 — Sourced catalogue and validation

Create `data/medicines.json` and a JSON Schema/validator. Curate an initial small set of **fully verified** PMBJP entries and exact brand comparisons, then continue toward 150–200 reviewed SKUs. Every PMBJP price/product code, molecule, strength, form, pack, brand MRP and NPPA ceiling has source metadata or `null`. Keep source documents/URLs and checked date. Include reviewer and status. Do not import Aayogya's generated prices or infer molecules from brand spellings.

**Check:** duplicate ID, missing source, wrong unit, mismatched strength/form/pack and missing price fixtures fail validation; valid incomplete row passes without a computed saving. **Commit now:** `data(backend): add sourced medicine catalogue and validator`. Commit later curation batches separately with reviewer evidence; do not wait to dump 200 rows at once.

### B2 — Fast fuzzy search and safe comparison

Normalize search query deterministically (case, punctuation, spacing), build brand/molecule aliases from verified rows, rank with RapidFuzz WRatio ≥75 and return all plausible strengths/forms separately. Publish public search labels/IDs through `/catalogue/public` with a dataset version and ETag for stale-labelled offline suggestions. Compare only user-selected `medicine_id`/`brand_id` exact pairs. Use integer paise, complete pack basis, `null` for missing data, independently applicable NPPA value, and basket exclusions. Never silently choose a strength or release type.

**Check:** misspelling, half-read brand, molecule search, multiple strengths, no match, brand-to-wrong-form rejection, absent NPPA/MRP, negative difference and multi-item arithmetic. Benchmark warm in-memory search on the target catalogue; record observed latency, not a zero-latency promise. **Commit now:** `feat(backend): add verified fuzzy search and price comparison`.

### B3 — Bounded OCR and Gemma→Groq normalization

Accept image types only, enforce byte/pixel limits, preprocess a transient copy with grayscale/contrast/threshold as useful, and run Tesseract in a bounded worker with timeout. Return raw text and low-confidence warnings. Implement a normalizer interface: **Gemma endpoint first when actually configured and verified**, Groq fallback on timeout/error, then deterministic OCR-token+fuzzy fallback. Validate model JSON and map all output to catalogue IDs. The model may clean query tokens and extract clearly observed strength text; it may not supply medical facts, prices, product codes or a confirmed dose. Current Groq-hosted `gemma2-9b-it` is deprecated; do not configure it as the Gemma route. Document the actual Gemma provider/model and proof of access in the implementation PR.

**Check:** printed box, blurred/handwritten sample, bad MIME/oversize, OCR timeout, malformed LLM JSON, unavailable Gemma, unavailable both LLMs, never-invented medicine ID. Verify search remains responsive during OCR work. **Commit now:** `feat(backend): add bounded OCR and safe normalization fallback`.

### B4 — Confirmed facts for agent and slips

Expose private, authenticated read-only catalogue lookup to the agent with reviewed Hindi/English usage summaries where present. Return no explanation when summary is absent. Ensure public compare response includes verified product code/source/date for the frontend print slip. No backend report-history API or original-image storage.

**Check:** agent token required, unknown ID returns 404, missing summary is explicit, print fields match source JSON exactly. **Commit now:** `feat(backend): expose reviewed medicine facts for agent and slip`.

### B5 — Places and routing

Curate a small, source-verified Kendra coordinate list with city/address/contact/hours only where known. Add a bounded city selector. Query OSM-derived pharmacy/clinic/hospital places through a rate-limited, cached backend adapter; show their provenance and do **not** relabel them as Kendras. Use OSRM GeoJSON route/steps with an explicitly configured driving profile; add walking only with a real foot profile. Limit coordinates, search radius and response size.

**Check:** near/far sort, missing coordinates, zero Kendras, city fallback, Overpass/OSRM outage, correct category labels, OSM attribution in UI. **Commit now:** `feat(backend): add sourced places and route API`.

### B6 — Real WhatsApp daily scheduler

Create PostgreSQL schedule/attempt tables and migrations. Accept only user-confirmed instruction, chosen daily time, `Asia/Kolkata`, explicit end date (within 30 days) and consent. Only the fixed test number is used. Send an approved Meta utility template through the official API. Verify webhook signature and map provider message IDs to `sent/delivered/failed`; a verified inbound `STOP` cancels future schedules for the fixed recipient. Protect the internal cron route with a secret; atomically claim due rows and deduplicate each scheduled occurrence. Issue a random per-reminder management token, store its hash, and require the token for status/cancellation. Expire attempt metadata after 30 days.

**Check:** invalid/missing end date, no consent, duplicate submission, duplicate cron tick, missed tick, expired schedule, cancellation, provider 429/5xx, accepted-vs-delivered distinction, one real message received at the test phone. **Commit now:** `feat(backend): schedule and track WhatsApp reminders`.

### B7 — Immediate Twilio/LiveKit call dispatch

Require user-confirmed checkup date/time/place; optionally doctor. On click, create an opaque call ID, random management token and protected short-lived context, then dispatch the LiveKit room/agent and Twilio outbound SIP participant to the fixed number. Apply disabled-provider response, idempotency, quotas and cooldown. Require the token for browser status; store only its hash. Capture real requested/ringing/answered/completed/failed events. Let the agent retrieve the confirmed context privately, never from untrusted room text alone. Delete context within 24 hours after terminal status.

**Check:** missing checkup, repeated click, incorrect recipient input rejected, Twilio trial restriction, unanswered/busy/failed call, answered two-way call, no invented appointment details. **Commit now:** `feat(backend): dispatch guarded immediate voice calls`.

### B8 — Integration, deployment and evidence

Run contract tests with Frontend and Agent owners, performance checks for search under OCR load, migration tests, and security review for secret handling. Deploy `backend` to Render with Neon `DATABASE_URL`; configure CORS for Cloudflare Pages, webhook URLs, and cron secret. Test cold-start behavior and record it; do not promise exact-minute reminders. Document all actual commands and environment keys in the root README.

**Check:** clean install, tests, real deployed search/scan/route, actual WhatsApp delivery webhook, actual answered call, no secret in logs/PR. **Commit now:** `chore(backend): validate and document deployed API`.

## Data and provider gates

The public source pages and provider offerings change. At each integration phase, use the linked official source in the root README, record the exact version/model/template selected and its test result, then implement. If a provider is unavailable, set its capability false and keep manual search operational. Never convert a simulated test into a “real delivery” claim.
