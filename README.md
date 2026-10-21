# AushadhAi

**Make the cost of medicine visible before it is paid.**

This repository is the documentation-first starting point for a three-person hackathon team. The application code has **not** been created yet. The first working milestone is simple: enter a brand or molecule, tolerate misspellings, and show a **verified, like-for-like** branded price against a Jan Aushadhi price with the saving as the headline. If the data is missing or the strength/form/pack does not match, the product must say so instead of calculating a saving.

> **Medical boundary:** Price and molecule information only. **Informational only — confirm with doctor or pharmacist before substituting.** OCR, Gemma, Groq and the voice agent cannot prescribe, infer a dosage, or invent a composition or price.

## Start here

| Owner | Read first | Responsibility |
| --- | --- | --- |
| Frontend / UI | [`Frontend/README.md`](Frontend/README.md) | Five-page React/Vite PWA, interaction and accessibility; visual design belongs to this owner. |
| Backend | [`backend/README.md`](backend/README.md) | FastAPI, verified catalogue, comparison, OCR/normalization, locations, WhatsApp and call dispatch. |
| AI agent | [`Agent/README.md`](Agent/README.md) | LiveKit voice worker, Groq voice LLM, bilingual speech, Murf Falcon TTS and Twilio SIP conversation. |

Read [`DESIGN.md`](DESIGN.md), [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md), [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md), and [`CONTRIBUTING.md`](CONTRIBUTING.md) before implementing an integration. Each owner README has ordered phases and an explicit **test → commit → continue** gate. Shared contracts belong on `main` before dependent branches implement them.

**Cross-team sequence:** commit this foundation on `main`; then F0, B0 and A0 can proceed in separate branches. B1/B2 unlock F1; B3 unlock F2; B5 unlock F4; frontend F3/F5 are local-first; B6 unlocks the real reminder part of F6; B7 and A1–A4 unlock the real call part of F6. Merge contract/data changes before dependent UI/agent PRs. The final F7/B8/A5 checks run against the integrated deployed build. Each owner commits at their phase gate instead of waiting for the final merge.

## Locked product flow

1. Search brand or molecule; show live fuzzy candidates with exact strength, form, release type and comparable pack.
2. Show `₹market → ₹PMBJP` and the estimated saving only for a verified comparable pair. Display NPPA ceiling separately when a directly applicable source record exists.
3. Scan a printed strip/box or prescription as an optional path. OCR output is a suggestion; the user corrects and confirms every medicine. Manual search is always available.
4. Save confirmed prescription summaries on this device; calculate a basket and print a counter slip. No login or cross-device sync. Original images are not retained after OCR processing.
5. Show curated Jan Aushadhi Kendras separately from other map places, with routes when a valid service response exists.
6. Let the user confirm a medicine reminder and choose its time. Send the **real** WhatsApp reminder to the configured test number using an approved template. A button starts an **immediate** outbound call to that same configured number about a confirmed checkup; there is no automatic two-day call.

The UI has five routes: `/`, `/scan`, `/prescriptions/:id`, `/stores`, `/history`. There is no login, pill-identifier, dashboard or separate voice page.

## Proposed stack and boundaries

| Layer | Choice | Constraint |
| --- | --- | --- |
| PWA | Vite, React, TypeScript, service worker | Cache the app shell; keep optional public catalogue labels in IndexedDB. Never cache private report/API responses in the service worker. |
| API | FastAPI, Pydantic, RapidFuzz, bounded OCR worker | Search stays usable when OCR or either LLM is unavailable. |
| Normalization | Gemma, then Groq fallback | Normalize noisy text into query tokens only; final medicine selection is dataset-backed and user-confirmed. |
| Data | Curated JSON/CSV with provenance; Neon Postgres for reminder/call state | `null` represents unknown price. No formula-generated prices. |
| Maps | Leaflet, OSM tiles, OSRM route service | Show tile attribution; never bulk-prefetch OSM tiles; label route profile accurately. |
| WhatsApp | Meta WhatsApp Business Platform | Approved reminder template, recipient opt-in, delivery webhook, idempotent dispatch. |
| Voice | LiveKit Agents, Groq LLM, Murf Falcon, Twilio SIP | Read-only verified-data tools; no model-generated medicine facts. |

These are implementation targets, not proof that the integrations are already live. Provider access, quotas and regional trial restrictions must be checked with real credentials in each owner's integration phase.

## Local development and deployment order

There are no runnable services yet. After owners complete their F0/B0/A0 phases:

1. Backend owner publishes the versioned API contract and safe `.env.example`; frontend uses a local API base URL. Agent uses a private backend URL and its own secret.
2. Start Neon or a local PostgreSQL instance, then FastAPI, then the PWA. Start the LiveKit worker only for voice testing. Run the backend dataset checks before connecting the UI.
3. Frontend deploys from repository root directory `Frontend`, build command `npm run build`, output `dist`, on **Cloudflare Pages**. `VITE_API_BASE_URL` contains the public **Render** API URL only. Vite client variables are public; never place keys there.
4. Backend deploys from `backend` on **Render** with secrets configured in Render and Neon as the persistent database. The voice owner deploys the worker to **LiveKit Cloud**. Configure Meta delivery webhook and a protected cron-job.org dispatch request after the live endpoints exist.
5. Verify the deployed PWA on laptop and phone over HTTPS. Cloudflare Tunnel is an optional laptop-based backup for local demos; Pages deployment does not require a tunnel.

**Free-tier limits:** Render Free may sleep after inactivity and has ephemeral local storage, so an external minute-level cron trigger and a successful API response do **not** guarantee a reminder arrives at an exact minute. Twilio, WhatsApp, Murf and voice services can have trial restrictions or usage charges. Do not market this stack as zero-cost, zero-latency, or clinical-grade delivery. The demo runbook records what actually happened.

See [`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md) for the real phone demo and failure checks.

## Source and tool credits

- Drug/product source to verify and cite per row: [PMBI Jan Aushadhi product list](https://janaushadhi.gov.in/product-portfolio/product-view-list).
- NPPA ceiling and available market-price lookup: [Pharma Sahi Daam](https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine). Brand MRP must also carry its own dated evidence when used.
- OCR: [Tesseract](https://tesseract-ocr.github.io/); fuzzy search: [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz).
- Maps: [Leaflet](https://leafletjs.com/), [OpenStreetMap](https://www.openstreetmap.org/copyright), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [OSRM API](https://project-osrm.org/docs/v5.5.1/api/).
- Voice: [LiveKit outbound SIP](https://docs.livekit.io/telephony/making-calls/outbound-calls/), [LiveKit Groq plugin](https://docs.livekit.io/agents/models/llm/groq/), [LiveKit Murf plugin reference](https://docs.livekit.io/reference/python/livekit/plugins/murf/index.html), [Twilio](https://www.twilio.com/docs/voice).
- Messaging: [Meta WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/cloud-api/), [WhatsApp pricing](https://whatsappbusiness.com/products/platform-pricing/).
- Hosting: [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Render Free](https://render.com/docs/free/), [Neon](https://neon.tech/docs/introduction), [cron-job.org](https://cron-job.org/en/faq/).

If any provider rule or API changes, update the owner README and this credit list from current official documentation in the same commit.

## Project status

- [x] Product boundaries and three-owner handoff documented.
- [ ] Runnable PWA, API, agent and verified medicine dataset.
- [ ] Real WhatsApp delivery and real Twilio/LiveKit call demonstrated.

Licensed under the [MIT License](LICENSE). Contributions follow [`CONTRIBUTING.md`](CONTRIBUTING.md).
