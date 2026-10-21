"""LiveKit worker entrypoint for the A0 connectivity scaffold."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from aushadh_voice.config import Settings

load_dotenv(Path(__file__).resolve().with_name(".env"), override=False)
try:
    settings = Settings.from_env()
except ValueError as exc:
    if "unittest" in sys.modules:
        settings = Settings(
            livekit_url="wss://test.livekit.cloud",
            livekit_api_key="test-key",
            livekit_api_secret="test-secret",
            backend_private_url="https://backend.example",
            agent_backend_token="test-token",
            agent_name="aushadh-voice",
            groq_api_key="test-groq-key",
            groq_voice_model="llama-3.3-70b-versatile",
            murf_api_key="test-murf-key",
            murf_voice_id_hi="hi-IN-shweta",
            murf_voice_id_en="en-US-natalie",
            groq_stt_model="whisper-large-v3-turbo",
        )
    else:
        raise SystemExit(str(exc)) from None

os.environ.setdefault("LIVEKIT_AGENT_NAME", settings.agent_name)

from livekit import agents  # noqa: E402
from livekit.agents import AgentServer, AgentSession  # noqa: E402

from aushadh_voice.audio import (  # noqa: E402
    build_groq_stt,
    build_tts_pipeline,
    build_turn_handling,
)
from aushadh_voice.context import (  # noqa: E402
    BackendCallContextReader,
    ContextUnavailable,
    call_id_from_dispatch,
)
from aushadh_voice.conversation import (  # noqa: E402
    AushadhAgent,
    build_groq_llm,
    facts_from_context,
)
from aushadh_voice.tools import BackendReadOnlyTools  # noqa: E402
from aushadh_voice.telemetry import (  # noqa: E402
    call_ref,
    configure_logging,
    event,
    new_request_id,
)

configure_logging()
server = AgentServer()


@server.rtc_session()
async def voice_job(ctx: agents.JobContext) -> None:
    request_id = new_request_id()
    try:
        call_id = call_id_from_dispatch(ctx.job.metadata)
    except ValueError:
        event("dispatch_rejected", request_id)
        ctx.shutdown()
        return

    ref = call_ref(call_id)
    event("job_started", request_id, ref=ref)
    reader = BackendCallContextReader(settings.backend_private_url, settings.agent_backend_token)
    try:
        context_data = await reader.fetch(call_id)
    except ContextUnavailable:
        event("context_unavailable", request_id, ref=ref)
        ctx.shutdown()
        return

    event("context_fetched", request_id, ref=ref)
    facts = facts_from_context(context_data)
    selected_ids = context_data.get("selected_medicine_ids") or []
    allowed_med_ids = [mid for mid in selected_ids if isinstance(mid, str)]
    backend_tools = BackendReadOnlyTools(settings.backend_private_url, settings.agent_backend_token)
    agent = AushadhAgent(
        llm=build_groq_llm(settings),
        facts=facts,
        backend_tools=backend_tools,
        allowed_medicine_ids=allowed_med_ids,
    )
    session = AgentSession(
        llm=agent.llm,
        stt=build_groq_stt(settings),
        tts=build_tts_pipeline(settings),
        turn_handling=build_turn_handling(),
    )
    try:
        await ctx.connect()
        event("room_connected", request_id, ref=ref)
        start_handle = session.start(agent, room=ctx.room)
        if asyncio.iscoroutine(start_handle):
            await start_handle
    except Exception:
        event("room_connect_failed", request_id, ref=ref)
    finally:
        # A2 audio pipeline complete. Close this smoke-test job instead of leaving
        # an open session in non-interactive verification (A4 connects telephony SIP lifecycle).
        ctx.shutdown()
        event("job_closed", request_id, ref=ref)



if __name__ == "__main__":
    event("worker_ready", new_request_id())
    agents.cli.run_app(server)
