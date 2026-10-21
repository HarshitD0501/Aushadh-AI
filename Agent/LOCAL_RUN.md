# A0 local worker setup

This phase registers a LiveKit worker and fetches private call context for a
dispatched job. It closes the test job after connecting. It cannot speak or
place a phone call yet; A1–A4 add those behaviors.

From `Agent/`, install Python 3.10+ and run:

```powershell
uv sync
Copy-Item .env.example .env
# Fill .env with a test LiveKit project and a matching backend agent token.
uv run python worker.py dev --log-level=warning
```

The worker uses LiveKit's built-in health endpoint. In production mode
(`uv run python worker.py start`), `GET http://localhost:8081/` returns 200
when connected and healthy, or 503 otherwise. Development mode uses a random
health port. A dispatch must contain JSON metadata with an opaque
`call_id`, for example `{"call_id":"test-call-1"}`. The worker calls
`GET /api/v1/internal/calls/{id}/context` with `AGENT_BACKEND_TOKEN`. Backend
must agree on this metadata convention before B7/A4 integration. The worker
never accepts a recipient or checkup facts from dispatch metadata.

Own logs contain an event, request ID, and a short SHA-256 call reference.
Compute the reference from the Backend call ID when correlating logs; the
raw ID, phone number, response body, transcript, and credentials are omitted.
Do not enable provider debug logs when handling real calls.

Without a test LiveKit project and running backend, only local configuration,
CLI, and mocked private-context checks can be completed. A healthy worker
does not prove a phone call was answered.
