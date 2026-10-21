# AI agent owner: LiveKit voice and Twilio calling

**Status:** Handoff only; no voice worker exists yet. Own this folder. Read [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md), [`../docs/DATA_POLICY.md`](../docs/DATA_POLICY.md), [`../docs/DEMO_RUNBOOK.md`](../docs/DEMO_RUNBOOK.md), and [`../CONTRIBUTING.md`](../CONTRIBUTING.md) first. Backend owns public call creation and the fixed recipient; Agent owns the conversation after LiveKit dispatch.

## Locked voice flow

`Call Patient` on a confirmed report calls `POST /api/v1/calls`. Backend creates a LiveKit room/call context and dials `DEMO_RECIPIENT_E164` via a configured Twilio outbound SIP trunk. The agent worker joins the room, retrieves the **confirmed** checkup record through a private authenticated backend tool, and speaks it to the answered patient. It then supports a short two-way Hindi/English conversation about confirmed checkup details, sourced molecule use, or nearby sourced stores. It does **not** call two days before automatically, dial numbers provided in UI, diagnose, prescribe, choose a replacement drug, or invent an appointment.

Use **Groq** for the voice LLM, not Gemma. For multilingual speech recognition, first verify the current LiveKit/Groq STT plugin with Hindi and English on the actual phone line. Use **Murf Falcon** for speech output after verifying the required Hindi/English voice IDs and account quota. Keep STT, LLM, TTS and transport behind replaceable adapters so failure is visible. A quoted “<400 ms” target is an aspiration to measure, **not** a guaranteed total call response time; telephony, STT, model, TTS and network all add delay.

## Conversation boundary

- Opening after answer: state that this is an AushadhAi reminder, read only user-confirmed checkup date/time/place/doctor (omit missing optional fields), then say the Hindi guardrail: **“मैं डॉक्टर नहीं हूँ। दवा बदलने से पहले अपने डॉक्टर या फार्मासिस्ट से सलाह ज़रूर लें।”** English equivalent: **“I am not a doctor. Confirm with a doctor or pharmacist before substituting a medicine.”**
- A medicine question calls Backend's authenticated read-only catalogue endpoint by a confirmed catalogue ID. It may paraphrase only a reviewed usage summary; include the disclaimer. Unknown or ambiguous medicine returns “I cannot verify that medicine; please ask your doctor or pharmacist.”
- A store question can read backend store/city facts only when the location is provided/confirmed; it cannot state stock availability unless a real verified stock source exists.
- A request for diagnosis, new medicine, dose change, substitution decision, interaction advice or unsupported home remedy receives a concise safe refusal/redirect to clinician/pharmacist. The agent can repeat sourced facts and confirmed reminders.
- Prompt text is a secondary control. Tool allowlists, immutable fact records and tests enforce the boundary. Do not give the LLM write access to reminders, calls, medicine data or prices.

## Phase sequence: test, commit, then continue

### A0 — Worker and configuration

Create a Python LiveKit Agents worker with typed settings, local run instructions, `.env.example`, request IDs and structured logs that omit phone numbers, transcript text and secrets. Define a private call-context fetch interface with `AGENT_BACKEND_TOKEN`. Keep worker start/health and telephony dispatch traceable to a call ID.

**Check:** worker starts with a test LiveKit project, missing required config fails clearly, no credential/transcript logged. **Commit now:** `chore(agent): scaffold LiveKit voice worker`.

### A1 — Groq voice reasoning and medical guardrails

Add the current supported LiveKit Groq LLM plugin/model after checking official model availability. Ground every response in a tool result or confirmed checkup context. Implement a short system policy, tool allowlist, output checks for unsupported dosage/price claims, and a fallback spoken error when backend facts are absent. No Gemma dependency in this folder.

**Check:** scripted tests for “what is this medicine for?”, ambiguous brand, “which drug should I take?”, “change my dose”, substitute request, unknown price and checkup date; no invented facts. **Commit now:** `feat(agent): add grounded Groq conversation policy`.

### A2 — Hindi/English audio pipeline

Connect LiveKit audio transport, multilingual STT and Murf Falcon TTS with a verified voice for the selected language. Tune endpointing/interruption and sensible timeouts. Measure time from end of user speech to first audible response on the actual call; report median and slow cases rather than asserting zero latency. Include a simple fallback if TTS/STT provider fails.

**Check:** Hindi and English scripted audio, noisy phone audio, silence, barge-in, provider timeout and measured latency on at least several calls. **Commit now:** `feat(agent): add bilingual STT and Murf Falcon speech`.

### A3 — Authenticated read-only tools

Fetch a call context by opaque call ID through backend authentication; fetch only verified catalogue usage summaries and sourced store results. Reject malformed or stale call context. Treat any text from the caller as untrusted and never let it become a catalogue ID without backend resolution and clarification.

**Check:** valid/expired/unknown call ID, wrong token, missing usage summary, unknown store, attempted prompt injection in caller speech; no write endpoint can be invoked. **Commit now:** `feat(agent): add verified medicine and store read tools`.

### A4 — Twilio outbound SIP lifecycle

Integrate with Backend's LiveKit room and Twilio SIP setup. Do not dial independently from untrusted agent text. Begin speaking only after answered state; do not claim a completed call for busy/no-answer/failure. Send lifecycle events to Backend through an authenticated channel so the UI can show real states. Keep a short call timeout and clean up room/context after end.

**Check:** verified test recipient receives an actual call, busy/no-answer/failure states, answered two-way conversation, correct checkup facts, single call after duplicate button clicks. **Commit now:** `feat(agent): handle outbound Twilio SIP conversations`.

### A5 — Real integration and deployment

Deploy the worker to LiveKit Cloud using currently supported instructions and environment secrets. Run the end-to-end UI-button→backend→room/SIP→answered phone→agent→status scenario. Test both Hindi and English and record actual latency, quota use and restrictions. Update root deployment/demo docs with exact commands and test evidence.

**Check:** fresh-start deployment, correct secret configuration, actual phone call and status, no PHI in logs, safe fallback during a backend/LLM outage. **Commit now:** `chore(agent): verify and document live voice deployment`.

## Required environment

See [`.env.example`](.env.example). `LIVEKIT_*`, `GROQ_API_KEY`, `MURF_API_KEY`, `BACKEND_PRIVATE_URL` and `AGENT_BACKEND_TOKEN` remain server-side. Backend alone stores the Twilio/LiveKit outbound trunk configuration and fixed phone recipient. Never commit a real call recording or transcript. Check [LiveKit outbound call docs](https://docs.livekit.io/telephony/making-calls/outbound-calls/), [Groq LLM plugin](https://docs.livekit.io/agents/models/llm/groq/), [Groq multilingual STT](https://console.groq.com/docs/speech-to-text), and [Murf plugin reference](https://docs.livekit.io/reference/python/livekit/plugins/murf/index.html) during implementation because plugin versions and supported models change.
