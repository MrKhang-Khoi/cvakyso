# BRIEFING — 2026-09-15T07:01:30Z

## Mission
Implement and execute the real-time load test for Requirement R3: 50 Concurrent Teachers Stress Test and Data Integrity Audit (`tests/stress_50_teachers_load_test.mjs`).

## 🔒 My Identity
- Archetype: Real-Time Performance & Concurrency Load Test Engineer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m4
- Original parent: fc1be572-e924-4b73-a27a-6e66e620c96e
- Milestone: M4 (R3: 50-Teacher Real-Time Load Test)

## 🔒 Key Constraints
- Exclusively own `tests/stress_50_teachers_load_test.mjs`.
- DO NOT modify server or application source code.
- Build test harness using Node.js native capabilities (`perf_hooks`, `http`, `fs`).
- 50 concurrent teacher sessions simultaneously within a 5-10s burst window.
- Each session represents an independent teacher submitting a lesson plan and signing electronically via `POST /api/documents` with proper auth headers, valid credentials, unique payload, signature placement coordinates.
- Measure Event Loop lag using `perf_hooks.monitorEventLoopDelay({ resolution: 10 })`.
- Measure latency via `performance.now()`.
- Metrics required: Total/Success/Failed requests, Success Rate (>= 98%), Min/Max/Avg/P95 latency, Event Loop Lag (Mean, P50, P90, P99, Max), Server CPU/RAM consumption before and after burst.
- Post-Test Strict Data Integrity Audit: Direct physical read of `data/documents.json`, verify exactly 50 new documents persisted, 0 lost updates, 0 corrupt JSON, 0 duplicate IDs, valid signature metadata, proper status (`COMPLETED` or `WAITING_NEXT_SIGN`).
- Must run cleanly with exit code 0 and genuine empirical metrics.

## Current Parent
- Conversation ID: fc1be572-e924-4b73-a27a-6e66e620c96e
- Updated: not yet

## Task Summary
- **What to build**: `tests/stress_50_teachers_load_test.mjs`
- **Success criteria**: 50 concurrent teacher requests, >= 98% success rate, exact 50 new records in `data/documents.json`, 0 lost updates, clean exit code 0, empirical metrics logged.
- **Interface contracts**: `PROJECT.md`
- **Code layout**: `tests/stress_50_teachers_load_test.mjs`

## Key Decisions Made
- [TBD]

## Artifact Index
- `tests/stress_50_teachers_load_test.mjs` — Test harness
- `.agents/worker_m4/handoff.md` — Final handoff report
- `.agents/worker_m4/progress.md` — Liveness progress log
- `.agents/worker_m4/BRIEFING.md` — Situational awareness

## Change Tracker
- **Files modified**: None yet. Owned: `tests/stress_50_teachers_load_test.mjs`
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: 0 violations
- **Tests added/modified**: `tests/stress_50_teachers_load_test.mjs`

## Loaded Skills
- **Source**: N/A
- **Local copy**: N/A
- **Core methodology**: N/A
