# Product design and content contract

This document defines **what the interface must communicate**. The frontend owner chooses the visual design and implements it. Do not turn illustrative copy or numbers into sourced medicine records.

## Audience and priority

The primary user may be older, hurried, using Hindi, on a small phone or weak network. The first view must make search obvious. When a fully verified comparison exists, the largest content element is the price transition and estimated saving. Every medical action and slip carries: **“Informational only — confirm with doctor or pharmacist before substituting.”** Hindi copy must convey the same meaning.

Accessibility and performance acceptance: usable at 360px width and 200% text zoom, readable number grouping and ₹ labels, keyboard-operable suggestions, visible focus, announced async status, explicit form labels, touch targets large enough for older users, and no map or voice library in the first-search bundle. Avoid motion required for comprehension. Language selection changes user-facing copy, not dataset facts.

## Page inventory

| Route | Required content and actions | Dependency and fallback |
| --- | --- | --- |
| `/` Search & Compare | Always-visible brand/molecule search; live candidates; exact strength/form/pack confirmation; market→PMBJP price hero, NPPA value when applicable, source/date, uncertainty, disclaimer; add to prescription, Scan, Find Store. | Search API failure shows retry and cached public catalogue if valid. No matched comparable price means no saving headline. |
| `/scan` Scan & Review | Camera/file input, upload progress, raw OCR, ranked candidates clearly marked unconfirmed, manual correction, strength/form selection, optional checkup details entry and confirmation. | On OCR/model failure the same manual search remains usable. No automatic reminder or dosage schedule. |
| `/prescriptions/:id` Prescription Detail | Confirmed medicine rows, quantity/pack, each valid comparison, basket totals over only valid pairs, printable chemist slip, reminder-time controls, confirmed checkup details and Call Patient action, message/call status. | A local ID that does not exist opens a recoverable “report not found” state. Missing-price rows stay visible but excluded from savings total. |
| `/stores` Find Stores | Geolocation or city search, list-first layout and lazy map; curated Kendras separated from pharmacy/clinic/hospital; address, contact/hours only when sourced, distance if coordinates exist; route polyline and steps when available. | Permission denied or network failure keeps the city selector and list usable. Do not claim another pharmacy is a Jan Aushadhi Kendra. |
| `/history` History | Device-local saved reports, date, verified comparison count, **estimated potential saving** aggregate; open and reprint. | Empty state links to Search/Scan. Explain that clearing browser data removes local history; no account or cross-device sync. |

Navigation: Search, Scan, Stores, History. Prescription Detail opens from search/scan/history. Do not add a dashboard, login, pill identifier, or separate voice page.

## Language and claim rules

- Show a price only with unit, pack basis, source and “checked on” date. Never compare different strengths, dosage forms, release types or pack quantities without normalization from verified source units.
- Label the branded figure as a dated **market MRP reference**. It is not a live quote from every nearby chemist; a shop may charge a different lawful price.
- Headline example `₹240 → ₹28` is **illustrative**, not a dataset record. Savings are **estimated potential savings**, not money the user actually spent or saved.
- “No verified comparison available” is an honest result. Never fill a missing field with `0` or a guess.
- OCR/Gemma/Groq candidate labels are “Possible match — please confirm.” The user must explicitly choose the medicine and reminder instructions.
- The fixed test phone number lives only in backend environment settings. UI has no phone-number input. Public call/reminder buttons require server-side quota, fixed recipient, idempotency and abuse controls.
- Call Patient initiates immediately **only when confirmed checkup details exist**. No scheduled two-day call. The agent may converse about the confirmed checkup and sourced medicine information, while directing substitution decisions to a doctor/pharmacist.
- Show WhatsApp state as `scheduled`, `sent`, `delivered` or `failed` based on actual scheduler/provider/webhook events. `sent` does not mean `delivered`.

## Common states to design

Each API-driven screen needs loading, success, empty, ambiguous match, offline, timeout and retry states. A stale or unavailable provider should not block manual medicine search. Cache the PWA app shell with the service worker and optional public search labels in IndexedDB; offline suggestions are marked stale and do not create new price comparisons. Medical reports live only in local IndexedDB; OCR images, private API responses and map tiles must not be pre-cached. Preserve unsent user-entered text locally during transient failures.

## Print slip

Use browser print/PDF rather than a new paid PDF service. Include only user-confirmed medicine, exact molecule/strength/form, PMBJP product code if verified, quantity, source/check date, and the medical disclaimer. If a product code is unknown, write “Not verified”; never generate one.
