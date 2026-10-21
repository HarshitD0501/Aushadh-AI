from __future__ import annotations

import unittest
from unittest.mock import patch

from livekit.agents import Agent, llm
from livekit.agents.llm import find_function_tools

from aushadh_voice.config import Settings
from aushadh_voice.conversation import (
    AushadhAgent,
    FALLBACK_EN,
    FALLBACK_HI,
    MEDICAL_DISCLAIMER_HI,
    VerifiedFact,
    build_groq_llm,
    facts_from_context,
    guard_response,
)


def settings(**overrides: str) -> Settings:
    values = {
        "LIVEKIT_URL": "wss://test.livekit.cloud",
        "LIVEKIT_API_KEY": "test-key",
        "LIVEKIT_API_SECRET": "test-secret",
        "BACKEND_PRIVATE_URL": "https://backend.example",
        "AGENT_BACKEND_TOKEN": "test-token",
        "GROQ_API_KEY": "test-groq-key",
        "MURF_API_KEY": "test-murf-key",
    }
    values.update(overrides)
    return Settings.from_env(values)


class GroqAgentTests(unittest.TestCase):
    def test_current_model_default_and_plugin_agent(self) -> None:
        configured = settings()
        self.assertEqual(configured.groq_voice_model, "llama-3.3-70b-versatile")
        agent = AushadhAgent(llm=build_groq_llm(configured))
        tools = find_function_tools(AushadhAgent)
        self.assertEqual([tool.info.name for tool in tools], ["read_verified_facts"])
        self.assertIsNotNone(agent)

    def test_model_can_be_overridden_by_server_config(self) -> None:
        self.assertEqual(settings(GROQ_VOICE_MODEL="openai/gpt-oss-120b").groq_voice_model, "openai/gpt-oss-120b")


class GroundingGuardTests(unittest.TestCase):
    def test_medical_decisions_always_redirect(self) -> None:
        facts = (VerifiedFact("medicine_usage", "reviewed usage", "Reviewed source summary."),)
        for question in (
            "Which drug should I take?",
            "Change the dose",
            "Can I substitute it?",
            "Do I have diabetes?",
            "Can I take this with my other medicine?",
            "दवा बदल दूँ?",
        ):
            with self.subTest(question=question):
                result = guard_response(question, "Take medicine A.", facts)
                self.assertFalse(result.allowed)
                self.assertTrue("doctor" in result.text.lower() or "फार्मासिस्ट" in result.text)

    def test_absent_or_ambiguous_facts_return_safe_fallback(self) -> None:
        cases = (
            ("What is this medicine for?", "It treats pain.", ()),
            ("Is Zedmox the right medicine?", "Yes, take it.", ()),
            ("What is the price?", "It costs ₹80.", ()),
            ("Where is the pharmacy?", "It is nearby.", ()),
        )
        for question, output, facts in cases:
            with self.subTest(question=question):
                result = guard_response(question, output, facts)
                self.assertFalse(result.allowed)

    def test_checkup_answer_requires_confirmed_fact_and_matching_numbers(self) -> None:
        question = "What is my checkup date?"
        fact = VerifiedFact("checkup", "confirmed date", "2026-10-21")
        self.assertTrue(guard_response(question, "Your checkup is on 21 October 2026.", (fact,)).allowed)
        result = guard_response(question, "Your checkup is on 22 October 2026.", (fact,))
        self.assertFalse(result.allowed)

    def test_unsupported_dosage_or_price_numbers_are_rejected(self) -> None:
        usage = VerifiedFact("medicine_usage", "reviewed usage", "Reviewed summary for 5 mg only.")
        price = VerifiedFact("price", "verified price", "₹120 per pack")
        self.assertFalse(guard_response("What is this medicine for?", "It is 10 mg.", (usage,)).allowed)
        self.assertFalse(guard_response("What is the price?", "It costs ₹200.", (price,)).allowed)

    def test_medicine_reply_must_echo_a_reviewed_fact_anchor(self) -> None:
        usage = VerifiedFact("medicine_usage", "reviewed usage", "Reviewed source summary.")
        self.assertFalse(guard_response("What is this medicine for?", "It treats pain.", (usage,)).allowed)
        safe = "Reviewed source summary. I am not a doctor. Confirm with a doctor or pharmacist before substituting a medicine."
        self.assertTrue(guard_response("What is this medicine for?", safe, (usage,)).allowed)

    def test_medical_disclaimer_is_required_and_new_claims_are_rejected(self) -> None:
        usage = VerifiedFact("medicine_usage", "reviewed usage", "Reviewed source summary.")
        self.assertFalse(guard_response("What is this medicine for?", "Reviewed source summary.", (usage,)).allowed)
        hindi = guard_response("यह दवा किस काम की है?", "Reviewed source summary. " + MEDICAL_DISCLAIMER_HI, (usage,))
        self.assertTrue(hindi.allowed)
        unsafe = "Reviewed source summary. It cures cancer. I am not a doctor. Confirm with a doctor or pharmacist before substituting a medicine."
        result = guard_response("What is this medicine for?", unsafe, (usage,))
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "unsupported_medicine_claim")

    def test_livekit_output_path_replaces_unsafe_medicine_reply(self) -> None:
        from aushadh_voice.conversation import FALLBACK_EN

        usage = VerifiedFact("medicine_usage", "reviewed usage", "Reviewed source summary.")
        agent = AushadhAgent(llm=build_groq_llm(settings()), facts=(usage,))
        chat_ctx = llm.ChatContext()
        chat_ctx.add_message(role="user", content="What is this medicine for?")
        unsafe = "Reviewed source summary. It cures cancer. I am not a doctor. Confirm with a doctor or pharmacist before substituting a medicine."

        async def fake_llm_node(_agent, _chat_ctx, _tools, _model_settings):
            yield unsafe

        async def collect() -> list[str]:
            with patch.object(Agent.default, "llm_node", new=fake_llm_node):
                return [chunk async for chunk in agent.llm_node(chat_ctx, [], None)]

        import asyncio
        output = asyncio.run(collect())
        self.assertEqual(output, [FALLBACK_EN])

    def test_unsolicited_medical_advice_on_non_medical_question_is_blocked(self) -> None:
        usage = VerifiedFact("medicine_usage", "reviewed usage", "Reviewed source summary.")
        non_medical_questions = (
            "Tell me a joke",
            "Hello who are you?",
            "What is the weather?",
            "Can you sing a song?",
        )
        unsafe_responses = (
            "Take 500mg paracetamol daily.",
            "You should change your dose to twice a day.",
            "I diagnose you with diabetes.",
            "You can substitute this medicine with aspirin.",
            "It costs ₹200 at the store.",
            "Reviewed source summary. It cures cancer. I am not a doctor. Confirm with a doctor or pharmacist before substituting a medicine.",
        )
        for q in non_medical_questions:
            for resp in unsafe_responses:
                with self.subTest(question=q, response=resp):
                    result = guard_response(q, resp, (usage,))
                    self.assertFalse(result.allowed)
                    self.assertTrue("doctor" in result.text.lower())

    def test_unsolicited_medical_advice_in_hindi_on_non_medical_question_is_blocked(self) -> None:
        usage = VerifiedFact("medicine_usage", "reviewed usage", "Reviewed source summary.")
        hindi_q = "नमस्ते, आप क्या कर सकते हैं?"
        unsafe_hindi_responses = (
            "दवा बदल लें और 500 मिलीग्राम लें।",
            "आपको यह दवा लेनी चाहिए।",
            "यह दवा दर्द ठीक करती है।",
        )
        for resp in unsafe_hindi_responses:
            with self.subTest(response=resp):
                result = guard_response(hindi_q, resp, (usage,))
                self.assertFalse(result.allowed)
                self.assertIn("डॉक्टर", result.text)
                self.assertIn(MEDICAL_DISCLAIMER_HI, result.text)

    def test_innocent_non_medical_exchange_passes_through(self) -> None:
        import asyncio
        agent = AushadhAgent(llm=build_groq_llm(settings()), facts=())
        chat_ctx = llm.ChatContext()
        chat_ctx.add_message(role="user", content="Hello, who are you?")
        innocent_reply = "Hello! I am AushadhAi's reminder assistant. How can I help you?"

        async def fake_llm_node(_agent, _chat_ctx, _tools, _model_settings):
            yield innocent_reply

        async def collect() -> list[str]:
            with patch.object(Agent.default, "llm_node", new=fake_llm_node):
                return [chunk async for chunk in agent.llm_node(chat_ctx, [], None)]

        output = asyncio.run(collect())
        self.assertEqual(output, [innocent_reply])

    def test_livekit_output_path_blocks_unsolicited_advice_on_non_medical_question(self) -> None:
        import asyncio
        agent = AushadhAgent(llm=build_groq_llm(settings()), facts=())
        chat_ctx = llm.ChatContext()
        chat_ctx.add_message(role="user", content="Tell me a joke.")
        unsafe_reply = "Take 500mg paracetamol daily."

        async def fake_llm_node(_agent, _chat_ctx, _tools, _model_settings):
            yield unsafe_reply

        async def collect() -> list[str]:
            with patch.object(Agent.default, "llm_node", new=fake_llm_node):
                return [chunk async for chunk in agent.llm_node(chat_ctx, [], None)]

        output = asyncio.run(collect())
        self.assertEqual(output, [FALLBACK_EN])


class FactsFromContextTests(unittest.TestCase):
    def test_extracts_checkup_and_raw_facts(self) -> None:
        payload = {
            "checkup": {
                "date_local": "2026-10-21",
                "time_local": "14:30",
                "place": "Civil Hospital",
                "doctor": "Dr. Sharma",
            },
            "facts": [
                {"kind": "medicine_usage", "label": "paracetamol", "value": "Fever relief"},
                {"kind": "invalid_kind", "label": "test", "value": "test"},
            ],
        }
        facts = facts_from_context(payload)
        self.assertEqual(len(facts), 5)
        self.assertEqual(facts[0], VerifiedFact("medicine_usage", "paracetamol", "Fever relief"))
        self.assertEqual(facts[1], VerifiedFact("checkup", "confirmed date", "2026-10-21"))
        self.assertEqual(facts[2], VerifiedFact("checkup", "confirmed time", "14:30"))
        self.assertEqual(facts[3], VerifiedFact("checkup", "confirmed place", "Civil Hospital"))
        self.assertEqual(facts[4], VerifiedFact("checkup", "confirmed doctor", "Dr. Sharma"))

    def test_empty_or_malformed_context_returns_empty_tuple(self) -> None:
        self.assertEqual(facts_from_context({}), ())
        self.assertEqual(facts_from_context(None), ())  # type: ignore[arg-type]


class WorkerIntegrationTests(unittest.TestCase):
    def test_voice_job_wires_a1_agent_and_session(self) -> None:
        import asyncio
        from unittest.mock import AsyncMock, MagicMock
        from worker import voice_job

        ctx = MagicMock()
        ctx.job.metadata = '{"call_id": "test-call-1"}'
        ctx.connect = AsyncMock()
        ctx.shutdown = MagicMock()
        ctx.room = MagicMock()

        with patch("worker.BackendCallContextReader") as mock_reader_cls, \
             patch("worker.AgentSession") as mock_session_cls:
            mock_reader = mock_reader_cls.return_value
            mock_reader.fetch = AsyncMock(return_value={"checkup": {"date_local": "2026-10-21"}})
            mock_session = mock_session_cls.return_value
            mock_session.start = MagicMock(return_value=None)

            asyncio.run(voice_job(ctx))

            self.assertTrue(ctx.connect.called)
            self.assertTrue(mock_session_cls.called)
            session_kwargs = mock_session_cls.call_args[1]
            self.assertIn("llm", session_kwargs)
            self.assertIn("stt", session_kwargs)
            self.assertIn("tts", session_kwargs)
            self.assertIn("turn_handling", session_kwargs)
            self.assertTrue(mock_session.start.called)
            agent_instance = mock_session.start.call_args[0][0]
            self.assertIsInstance(agent_instance, AushadhAgent)
            self.assertEqual(len(agent_instance._facts), 1)
            self.assertEqual(agent_instance._facts[0].value, "2026-10-21")
            self.assertTrue(ctx.shutdown.called)


if __name__ == "__main__":
    unittest.main()
