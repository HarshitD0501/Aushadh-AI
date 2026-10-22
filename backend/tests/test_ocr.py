"""Image validation, bounded OCR and safe local catalogue resolution tests."""

import asyncio
import json
import unittest
from io import BytesIO

import httpx
from fastapi.testclient import TestClient
from PIL import Image

from app.catalogue.service import CatalogueService
from app.config import Settings
from app.errors import AppError
from app.main import create_app
from app.normalization.providers import OCRNormalizer, validate_normalized_lines
from app.ocr.imaging import preprocess_image
from app.ocr.service import OCRService, _normalization_lines, parse_tsv


def png_bytes(width=120, height=60):
    image = Image.new("RGB", (width, height), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def provider_output(lines):
    return {"lines": [{"line_index": index, "query_tokens": ["Telmisartan"]}
                       for index, _line in enumerate(lines)]}


class OCRAndNormalizerTests(unittest.TestCase):
    def test_preprocessing_checks_declared_and_actual_type_and_pixel_limit(self):
        source = png_bytes()
        result = preprocess_image(source, "image/png", max_pixels=10_000)
        with Image.open(BytesIO(result)) as image:
            self.assertEqual(image.mode, "L")
            self.assertEqual(image.format, "PNG")
        with self.assertRaises(AppError) as mime_error:
            preprocess_image(source, "image/jpeg", max_pixels=10_000)
        self.assertEqual(mime_error.exception.code, "INVALID_IMAGE")
        with self.assertRaises(AppError) as media_error:
            preprocess_image(source, "application/pdf", max_pixels=10_000)
        self.assertEqual(media_error.exception.code, "UNSUPPORTED_MEDIA_TYPE")
        with self.assertRaises(AppError) as pixel_error:
            preprocess_image(source, "image/png", max_pixels=100)
        self.assertEqual(pixel_error.exception.status_code, 413)

    def test_tsv_parser_returns_text_and_mean_word_confidence(self):
        tsv = (
            "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t80\tTELMISARTAN\n"
            "5\t1\t1\t1\t1\t2\t12\t0\t10\t10\t60\t40mg\n"
        )
        self.assertEqual(parse_tsv(tsv), ("TELMISARTAN 40mg", 70.0))

    def test_only_medicine_like_text_is_sent_for_normalization(self):
        lines = _normalization_lines(
            "Patient Name Harshit\nTELMISARTAN 40 MG OD after breakfast\n"
            "1-0-0 after food\nA2B 40 MG"
        )
        self.assertEqual(lines, ["TELMISARTAN 40 MG", "A2B 40 MG"])

    def test_provider_tokens_cannot_add_unobserved_strength_and_keep_observed_strength(self):
        output = {"lines": [{"line_index": 0, "query_tokens": ["Telmisartan"]}]}
        parsed = validate_normalized_lines(output, ["Telmisartan 40 mg"])
        self.assertEqual(parsed, {0: ["Telmisartan 40mg"]})
        invented = {"lines": [{"line_index": 0, "query_tokens": ["Telmisartan 80mg"]}]}
        with self.assertRaises(ValueError):
            validate_normalized_lines(invented, ["Telmisartan 40 mg"])

    def test_gemma_primary_and_groq_fallback_with_untrusted_json_validation(self):
        requests = []

        def handler(request):
            requests.append(request)
            if request.url.host == "generativelanguage.googleapis.com":
                return httpx.Response(503, json={"error": "test outage"})
            return httpx.Response(200, json={"choices": [{"message": {
                "content": json.dumps(provider_output(["Telmisartan 40 mg"]))
            }}]})

        settings = Settings(
            _env_file=None,
            gemma_api_key="test-gemma-key",
            groq_api_key="test-groq-key",
            groq_normalizer_model="test-model",
        )
        normalizer = OCRNormalizer(settings, transport=httpx.MockTransport(handler))
        provider, normalized = asyncio.run(normalizer.normalize(["Telmisartan 40 mg"]))
        self.assertEqual(provider, "groq")
        self.assertEqual(normalized, {0: ["Telmisartan 40mg"]})
        self.assertEqual([request.url.host for request in requests], [
            "generativelanguage.googleapis.com", "api.groq.com"
        ])
        self.assertEqual(requests[0].headers["x-goog-api-key"], "test-gemma-key")
        self.assertEqual(requests[1].headers["authorization"], "Bearer test-groq-key")
        self.assertNotIn("Telmisartan", requests[0].url.query.decode())

    def test_model_failure_degrades_to_none_and_does_not_echo_fake_ids(self):
        transport = httpx.MockTransport(lambda _request: httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": json.dumps({
                "lines": [{"line_index": 0, "query_tokens": ["MadeUpDrug 80 mg"]}],
                "candidate_medicine_ids": ["fake-id"],
            })}]}}]
        }))
        settings = Settings(_env_file=None, gemma_api_key="test-key")
        provider, normalized = asyncio.run(
            OCRNormalizer(settings, transport=transport).normalize(["MadeUpDrug 40 mg"])
        )
        self.assertEqual(provider, "none")
        self.assertEqual(normalized, {})

    def test_ocr_endpoint_returns_catalogue_ids_unconfirmed_and_handles_unavailable(self):
        app = create_app(Settings(_env_file=None))
        service = app.state.ocr
        service.executable = "fake-tesseract"

        async def recognize(_image, _executable, _timeout):
            return "TELMISARTAN 40 MG\nPatient Name Harshit\n1-0-0 after breakfast", 80

        class NoNormalizer:
            available = False

            async def normalize(self, _lines):
                return "none", {}

        service.recognizer = recognize
        service.normalizer = NoNormalizer()
        with TestClient(app) as client:
            response = client.post("/api/v1/ocr", files={
                "image": ("strip.png", png_bytes(), "image/png")
            })
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["normalization_provider"], "none")
            self.assertEqual(payload["suggestions"][0]["candidate_medicine_ids"], ["pmbjp-300"])
            self.assertEqual(payload["suggestions"][0]["status"], "unconfirmed")
            self.assertIn("Patient Name", payload["raw_text"])
            self.assertEqual(len(payload["suggestions"]), 1)

            bad = client.post("/api/v1/ocr", files={
                "image": ("bad.jpg", png_bytes(), "image/jpeg")
            })
            self.assertEqual(bad.status_code, 400)
            self.assertEqual(bad.json()["error"]["code"], "INVALID_IMAGE")

            service.executable = None
            unavailable = client.post("/api/v1/ocr", files={
                "image": ("strip.png", png_bytes(), "image/png")
            })
            self.assertEqual(unavailable.status_code, 503)
            self.assertEqual(unavailable.json()["error"]["code"], "OCR_UNAVAILABLE")

    def test_worker_limit_rejects_concurrent_ocr_and_timeout_is_bounded(self):
        settings = Settings(_env_file=None, ocr_timeout_seconds=1, ocr_worker_count=1)
        service = OCRService(settings, CatalogueService.from_path())
        service.executable = "fake-tesseract"
        entered = asyncio.Event()
        release = asyncio.Event()

        async def slow_recognizer(_image, _executable, _timeout):
            entered.set()
            await release.wait()
            return "TELMISARTAN 40 MG", 90

        class NoNormalizer:
            async def normalize(self, _lines):
                return "none", {}

        service.recognizer = slow_recognizer
        service.normalizer = NoNormalizer()

        async def exercise():
            pending = asyncio.create_task(service.analyze(png_bytes(), "image/png"))
            await entered.wait()
            with self.assertRaises(AppError) as busy:
                await service.analyze(png_bytes(), "image/png")
            self.assertEqual(busy.exception.code, "OCR_BUSY")
            with self.assertRaises(AppError) as timed_out:
                await pending
            self.assertEqual(timed_out.exception.code, "OCR_TIMEOUT")
            with self.assertRaises(AppError):
                await service.analyze(png_bytes(), "image/png")
            release.set()
            await asyncio.sleep(0.05)
            self.assertEqual(service._slots.qsize(), 1)

        asyncio.run(exercise())


if __name__ == "__main__":
    unittest.main()
