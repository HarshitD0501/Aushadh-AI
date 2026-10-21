# Contributing to AushadhAi

This is a hackathon repository. A clean, **honest** history is part of the deliverable. Each contributor owns one area and commits a small verified slice before beginning the next phase.

## Initial setup and branches

The documentation foundation starts on `main`. After it is committed, each owner creates a branch from the latest `main`: `feature/frontend`, `feature/backend`, or `feature/agent`. Do not merge another project's Git history or claim tests you did not run. Do not rewrite a teammate's published branch. Merge shared API/data contract changes first, then rebase or merge `main` into dependent branches.

PowerShell example after Git is initialized:

```powershell
git switch main
git pull --ff-only
git switch -c feature/frontend
```

Replace the last branch name for the other owners. If no remote exists yet, omit `git pull --ff-only` until one is configured.

## Phase and commit rule

1. Read the root docs and your owner README. Pick **one** numbered phase or one smaller independently testable slice.
2. Implement only that slice. If an API shape must change, update `docs/API_CONTRACT.md` and notify the other owners before implementing consumers.
3. Run that phase's acceptance check. Record the command/result in the PR description. If a live provider was not tested, say “not tested” and why.
4. Review `git diff --check` and `git status`. Stage only your intended files. Commit with the suggested phase message or a more precise equivalent, such as `feat(backend): add verified medicine search`.
5. **Stop and commit before starting the next phase.** The owner README repeats the commit gate at every phase.

Prefer one real behavior per commit over a single end-of-hackathon dump. Documentation corrections can be separate `docs:` commits. Never backdate, fabricate, squash away substantive work merely to look busy, or add vendor code without attribution.

## Pull request checklist

- [ ] Change matches a requested product feature; no feature copied from the reference repository by assumption.
- [ ] Dataset facts have source URL, checked date, unit/pack and reviewer evidence. Unknown values remain unknown.
- [ ] OCR/LLM output is unconfirmed until the user selects a dataset record; no model-created medical or price facts.
- [ ] UI shows required disclaimer and an honest failure state; test at 360px and with keyboard.
- [ ] Tests/checks named in the phase passed; real external-provider status is stated accurately.
- [ ] No `.env`, token, patient number, original prescription image, webhook payload, or private health data is committed or logged.
- [ ] README/API contract/credits updated for changed behavior or dependency.

## Security and data review

Use only `.env.example` for variable names and harmless placeholders. Never put server credentials in `VITE_*` variables. Validate and cap image uploads, normalize database inputs, verify Meta webhook signatures, restrict internal cron and agent calls, use fixed demo recipient and rate limits, and persist only the minimum data needed for scheduled work. Local history has no login and will not sync. Any accidental leaked credential must be revoked and rotated before continuing; deleting it in a later commit does not remove it from history.

## Licensing and credit

Project code uses the root MIT license. New datasets need their own provenance and redistribution check before commit. Credit upstream libraries, APIs, models, map data and copied code in `README.md`; do not imply the Aayogya reference repo is this project's codebase.
