## 2026-09-15T00:01:11Z
You are Worker M4 (Real-Time Performance & Concurrency Load Test Engineer) for the EduSign VGCA system.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m4
Read the authoritative user request at:
c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md

File Ownership: You exclusively own `tests/stress_50_teachers_load_test.mjs`. DO NOT modify server or application source code.

Inputs to study:
- Detailed concurrency & bottleneck analysis in: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_survey_3\handoff.md`
- Hardened dataStore handoff in: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m1\handoff.md`
- Master project index: `c:\Users\HPZBook\Desktop\KÝ SỐ\PROJECT.md`

Your Mission:
Implement and execute the real-time load test for Requirement R3:
1. Build `tests/stress_50_teachers_load_test.mjs` using Node.js native capabilities (`perf_hooks`, `http`, `fs`).
2. The harness must fire 50 concurrent teacher sessions simultaneously within a 5-10s burst window:
   - Each session represents an independent teacher submitting a lesson plan and signing electronically via `POST /api/documents` (with proper auth headers `x-user-id`, `x-user-username`, valid teacher credentials, unique payload, signature placement coordinates).
   - Use `perf_hooks.monitorEventLoopDelay({ resolution: 10 })` to measure Event Loop lag across the entire burst.
   - Measure individual request latencies via `performance.now()`.
   - Compute and log:
     * Total requests, Successful requests, Failed requests.
     * Success Rate (MUST achieve >= 98%).
     * Minimum, Maximum, Average Latency, and P95 Latency.
     * Event Loop Lag: Mean, P50, P90, P99, Max.
     * Server CPU/RAM consumption before and after the burst.
3. Post-Test Strict Data Integrity Audit:
   - Directly read physical `data/documents.json` from disk (bypassing in-memory cache) and compare against pre-test baseline.
   - Verify that exactly 50 new document records were persisted.
   - Verify 0 lost updates, 0 corrupt JSON structures, 0 duplicate IDs.
   - Verify that every created document has valid signature metadata and proper status (`COMPLETED` or `WAITING_NEXT_SIGN`).
4. Execution & Verification:
   - Make sure local server is running (e.g. on port 3000 or dedicated test port).
   - Run `node tests/stress_50_teachers_load_test.mjs`.
   - Ensure the test completes cleanly with exit code 0 and outputs full empirical metrics.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When finished, write your handoff report to:
`c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m4\handoff.md`
And send a completion message back to your parent.
