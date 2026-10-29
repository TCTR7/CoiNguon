# Project instructions — Cội Nguồn

## Scope and reading order
- Apply these instructions throughout this repository; respect more specific AGENTS.md files when present.
- Read docs/ai_agents/PROJECT_STATE.md and the relevant sections of docs/PRD_CoiNguon_App.md first.
- Read only task-relevant sections of IMPLEMENTATION_PLAN.md, ARCHITECTURE.md, DEVELOPMENT.md, and TESTING.md; do not reload the whole documentation set each turn.
- For frontend work, follow the UI direction and accessibility criteria in docs/IMPLEMENTATION_PLAN.md.
- PRD defines intended behavior; source code and actual command output establish implemented behavior. Report discrepancies instead of pretending either is already aligned.
- Explicit user instructions govern the task. Proposed decisions in docs are not user approvals.

## Working conventions
- Communicate with the owner in Vietnamese; use English code identifiers. Preserve UTF-8 Vietnamese text.
- Inspect existing files and changes before editing. Preserve unrelated user work; do not reset, overwrite, or clean it up.
- Keep each task within MVP scope. Do not add payments, marketplace, white-label, or offline writes incidentally.
- Make routine reversible choices autonomously. Ask only when unresolved decisions materially affect behavior, privacy, cost, or external actions; continue independent work meanwhile.
- Prioritize reasoning, planning, implementation, and verification over documentation overhead.
- Do not create implementation journals, session logs, ADRs, or separate handoff reports unless explicitly requested.
- Keep current architectural choices directly in ARCHITECTURE.md; update only when needed, without decision history.
- Do not claim an unavailable command passed or a proposed directory already exists.

## Product invariants
- Account, person record, and clan membership are separate concepts; isolate every clan's data.
- Enforce authorization in the backend/data rules, never solely in UI.
- Preserve original dates/calendar type; separate death date, anniversary rule, and actual event date.
- Do not invent missing genealogical data or silently resolve exceptional lunar dates.
- Use idempotency and concurrency protection for RSVP, delegation, and reminders.
- Offline is read-only; never silently queue writes. Keep private caches and guest links controlled.
- Use synthetic people in tests and demos; do not commit real family data, tokens, credentials, or service-account keys.

## Verification and handoff
- Follow docs/TESTING.md; test changed behavior and failure paths proportionately.
- Before running project commands, inspect actual manifests/scripts. Available local commands and emulator prerequisites are listed in docs/DEVELOPMENT.md.
- Do not deploy, enable billing, modify production data, or send external invitations without authorization covering that action.
- Update relevant specifications only when behavior or setup changes.
- PROJECT_STATE.md is a current snapshot, not a log: at most 10 short lines covering progress, next step, and blockers; include a check result only if needed to resume safely. Replace stale content, never append session history.
- Update the snapshot only when implementation progress, next step, or blockers change; skip it for routine documentation edits.
- Finish with what changed, evidence of checks, and remaining limitations. Mark unrun checks explicitly.
