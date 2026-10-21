# Dataset, calculation and medical safety policy

## Source hierarchy and provenance

1. **PMBJP product and price:** use an official PMBI Jan Aushadhi product/price publication. Record source URL or official document identifier, date checked, product code, molecule composition, strength, form, release type, pack size and price unit.
2. **NPPA ceiling:** use an applicable NPPA scheduled formulation/ceiling record with notification reference, effective date and unit. Not every product has an applicable NPPA ceiling. Absence means `null`.
3. **Market MRP:** record the exact branded product, pack and dated MRP evidence from a manufacturer pack/list or other reviewable source. The NPPA ceiling is **not** a substitute for market MRP.

The intended catalogue is 150–200 useful, reviewed Indian medicine SKUs, but coverage is **earned row by row**. A small, fully verified demo subset is acceptable while curation continues. Do not inflate a count by copying strength variants, deriving ingredients from name suffixes, guessing product codes, or generating prices. The reference Aayogya ZIP is not a verified data source and must not be copied into this dataset without independent verification and redistribution review.

Dataset location once implemented: `backend/data/medicines.json`. Each record should carry:

```text
medicine_id; PMBJP product_code; molecule_components with amount/unit;
strength_label; form; release_type; pack_quantity and pack_unit;
pmbjp_price_paise and source metadata; applicable_nppa_price or null;
brand_products[] with brand_id, name, exact pack/MRP or null and source metadata;
reviewed_by; reviewed_on; record_status (verified|incomplete|retired).
```

Put the detailed JSON Schema beside the dataset during B1. Validate uniqueness, required source fields, nonnegative paise, parseable dates and exact pack compatibility in CI. Public search can include incomplete records, but compare must calculate savings only for verified comparable pairs. Use representative tests for same molecule with **different strengths, dosage forms, release types and pack sizes**.

## Price arithmetic

Use integer paise. For `N` packs, `market_total = market_pack_price × N`, `pmbjp_total = pmbjp_pack_price × N`, `saving = market_total − pmbjp_total`, and `saving_percent = 100 × saving / market_total` when market total is positive. If either price is missing or the pack basis is incompatible, all saving fields are `null`. If the generic is dearer, show the negative difference honestly; do not label it a saving. Sum only comparable lines in the basket and show how many lines were excluded. Format ₹ in UI after arithmetic; never round before summing.

Prices are indicative and may change. Show the price unit and checked date. A Jan Aushadhi Kendra's **stock availability is not known** unless a real stock source is integrated; map presence is not stock proof.

## OCR, LLM and dosage boundaries

- Preprocessing may grayscale, stretch contrast and threshold a copy of the image; retain the original only in memory during the request. Set image byte/pixel caps, OCR worker timeout and bounded concurrency. Printed boxes/strips are the reliable demo case; handwritten prescriptions can fail.
- Tesseract returns raw text. Gemma first and Groq fallback may turn noisy text into **query tokens** and explicitly observed strength tokens. Both outputs are untrusted. Run a deterministic catalogue lookup, return candidates and require user confirmation. If Gemma access is not available on the chosen free deployment, document that and let deterministic OCR+fuzzy search remain usable; do not pretend Gemma executed.
- An observed instruction such as “after breakfast” may be displayed as unconfirmed OCR text. Neither OCR nor an LLM may activate a schedule or turn an unclear mark into a dose. User must type/confirm the exact reminder text, time and end date.
- Model explanations can simplify **sourced, reviewed molecule-use text** in Hindi/English. Do not let the model answer open-ended treatment, diagnosis, substitution, drug-interaction or dosage questions from its own knowledge. Always include the substitution disclaimer.
- Voice agent reads confirmed checkup facts and backend read-only medicine/store facts. It does not diagnose or prescribe. Spoken Hindi guardrail: “मैं डॉक्टर नहीं हूँ। दवा बदलने से पहले अपने डॉक्टर या फार्मासिस्ट से सलाह ज़रूर लें।”

## Privacy and retention

No login. The browser keeps only the confirmed summary, price snapshot and opaque management tokens in IndexedDB. The backend processes original images transiently and does not save or log them. A reminder needs minimal server-side medicine label, confirmed instruction, time/end date, fixed recipient reference and delivery state; schedules expire no later than 30 days after creation. A call needs confirmed checkup context until completion and deletes it within 24 hours after terminal status. Retain delivery attempt metadata for at most 30 days for the demo, then delete it. Third-party OCR/LLM and voice APIs receive only data necessary for their operation; mention this clearly in the UI before upload/call. Never commit real patient data or real `.env` files.

## Curation acceptance checklist

- [ ] PMBJP source and price identifiable and recently checked.
- [ ] Molecule, strength, dosage form, release type, pack size and product code checked by a human reviewer.
- [ ] Market MRP source points to the exact brand/pack, or MRP is `null`.
- [ ] NPPA notification applies to this formulation/unit, or ceiling is `null`.
- [ ] Dataset license/redistribution terms checked; official source credited.
- [ ] Automated schema and comparison tests pass; reviewer name/date recorded.

Authoritative lookup starting points: [PMBI product list](https://janaushadhi.gov.in/product-portfolio/product-view-list) and [NPPA Pharma Sahi Daam](https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine). Those pages can change; record exact source document/version during curation.
