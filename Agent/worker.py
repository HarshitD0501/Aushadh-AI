"""LiveKit worker entrypoint for the A0 connectivity scaffold."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

from aushadh_voice.config import Settings

load_dotenv(Path(__file__).with_name(".env"), override=False)
try:
    settings = Settings.from_env()
except ValueError as exc:
    raise SystemExit(str(exc)) from None

os.environ.setdefault("LIVEKIT_AGENT_NAME", settings.agent_name)

from livekit import agents  # noqa: E402
from livekit.agents import AgentServer, AgentSession  # noqa: E402

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
    agent = AushadhAgent(llm=build_groq_llm(settings), facts=facts)
    session = AgentSession(llm=agent.llm)
    try:
        await ctx.connect()
        event("room_connected", request_id, ref=ref)
        start_handle = session.start(agent, room=ctx.room)
        if asyncio.iscoroutine(start_handle):
            await start_handle
    except Exception:
        event("room_connect_failed", request_id, ref=ref)
    finally:
        # A1 integration complete. Close this smoke-test job instead of leaving
        # an apparently live, silent agent in an outbound call (A2 adds audio pipeline).
        ctx.shutdown()
        event("job_closed", request_id, ref=ref)



if __name__ == "__main__":
    event("worker_ready", new_request_id())
    agents.cli.run_app(server)
