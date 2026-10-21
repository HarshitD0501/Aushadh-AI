# Demo and deployment runbook

**Status:** Steps to execute after code and provider credentials exist. Do not claim a check passed merely because it appears here.

## Before the event

1. Confirm all three deployment URLs and `GET /api/v1/health`/`capabilities`. Keep a local copy of the public verified catalogue and a printed strip/box; do not use a real patient's prescription without consent.
2. Confirm PMBJP/market example rows have exact pack/strength and dated source evidence. Record one typo query, one molecule query and one missing-price case. Do not use `₹240 → ₹28` as a real row unless both prices are verified.
3. Verify the Meta test number is opted in/allowed and the utility template is approved. Verify the Twilio trial recipient and caller configuration, LiveKit outbound trunk, agent worker, Groq/Murf access, and provider quotas. Use the **same backend-only** `DEMO_RECIPIENT_E164` for both features.
4. Check the reminder cron secret, timezone `Asia/Kolkata`, dispatch endpoint and Meta status webhook. Set a real reminder a few minutes ahead, confirm it reaches the handset, and capture `delivered` webhook evidence. A send API success alone is insufficient.
5. Make one real outbound call from the UI with confirmed checkup details; answer it on the handset, listen to the checkup opening, ask one allowed medicine/store question, and check call status. There is no automatic two-day call.
6. Open the HTTPS PWA on laptop/projector and on phone, confirm install prompt or Add to Home Screen behavior, camera permission, map attribution and offline shell. Test at 360px and poor-network throttling. Make sure no secrets appear in browser devtools or Vite build output.

## Live five-minute path

| Time | Judge action | Evidence |
| --- | --- | --- |
| 0:00 | Enter a misspelled brand; choose exact strength/form/pack. | Dataset-backed suggestions and explicit confirmation. |
| 0:45 | Reveal verified brand→PMBJP price and source/date. | Saving headline; NPPA separately if truly applicable. |
| 1:20 | Scan printed packaging; correct one OCR candidate; build a basket. | Manual fallback still visible; only confirmed items count. |
| 2:10 | Open Kendras and route; print counter slip. | Kendra distinct from generic pharmacy; route steps and source. |
| 3:00 | Choose a confirmed daily reminder time a few minutes ahead and end date; schedule. | Actual handset WhatsApp message and `delivered` status once webhook arrives. |
| 4:00 | Enter/confirm checkup information; tap Call Patient; answer test phone. | Real ringing/answered status and live two-way agent conversation. |

Network or provider delay can disrupt this schedule. Preserve the first four core actions independently of WhatsApp/voice. If a provider fails, show the real failure state; never fake a received message, delivery webhook or answered call.

## Hosting configuration (when implementation exists)

- **Cloudflare Pages:** connect the GitHub repo; production branch `main`; project root `Frontend`; Vite build `npm run build`; output `dist`; environment `VITE_API_BASE_URL=https://<render-service>.onrender.com`. Configure SPA fallback and test deep links. This is HTTPS and supports phone installation; Tunnel is unnecessary for deployed Pages.
- **Render:** deploy `backend` as a Python web service using the actual implementation's install/start commands; add all backend secrets in Render, never Git. Set the public Pages origin in CORS. Render Free can sleep and its local filesystem is ephemeral, so use Neon for scheduled state, not SQLite/local files.
- **Neon:** create a database, put `DATABASE_URL` in Render only, apply reviewed schema migrations, test connection and backup/export procedure.
- **LiveKit Cloud:** deploy the agent worker from `Agent`, configure LiveKit/Groq/Murf/private-backend secrets, outbound SIP trunk to Twilio, and verify a real Indian test-number call within trial rules.
- **Meta:** configure official WhatsApp Business Platform phone ID/token, approved reminder template, test-recipient opt-in and HTTPS webhook with signature verification. Check current pricing and template rules before the demo.
- **cron-job.org:** configure a once-per-minute request to the protected backend dispatch endpoint with `REMINDER_CRON_SECRET`. Watch dispatch logs and Meta delivery statuses. Free hosting does **not** guarantee exact-minute delivery.

Official deployment references: [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Render Free limitations](https://render.com/docs/free/), [LiveKit outbound calls](https://docs.livekit.io/telephony/making-calls/outbound-calls/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Local backup

Run all services locally and project the localhost PWA. For a physical phone on the same Wi-Fi, use a LAN address with a secure-context strategy appropriate to camera/PWA features; HTTPS deployment is simpler. Cloudflare Quick Tunnel can expose a local backend temporarily (`cloudflared tunnel --url http://localhost:<port>`), but its random URL changes after restart and webhooks must be updated. Never expose an unprotected internal cron or call endpoint through a tunnel.
