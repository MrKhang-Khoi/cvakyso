## 2026-09-14T23:54:03Z
You are Worker M1 (Data Persistence & Concurrency Engineer) for the EduSign VGCA system.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m1
Read the authoritative user request at:
c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md

File Ownership: You exclusively own `dataStore.js`. DO NOT modify any other source files.

Inputs to study:
- Detailed concurrency & bottleneck analysis in: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_survey_3\handoff.md`
- Master project index: `c:\Users\HPZBook\Desktop\KÝ SỐ\PROJECT.md`

Your Mission:
Harden `dataStore.js` to withstand 50 concurrent teacher signature operations without race conditions, lost updates, or Event Loop freezes:
1. In-memory updates: Ensure `_docsCache` is updated immediately and synchronously so subsequent in-memory reads via `getDocuments()` always see the freshest data.
2. Serialized Async Write Queue: Implement an asynchronous serialized queue for persisting `_docsCache` to `data/documents.json`. If multiple `saveDocuments()` calls arrive concurrently within milliseconds, coalesce/serialize the disk write operations so that pending updates are written in strict sequential order without file locking clashes.
3. Eliminate `Atomics.wait(buf, 0, 0, 50)`: The current `saveJsonSafe` uses `Atomics.wait` in a busy-wait retry loop which blocks the Node.js V8 Event Loop for 50ms per retry on Windows NTFS. Replace this with a non-blocking asynchronous retry (e.g. `await new Promise(r => setTimeout(r, ...))` or async queue retry).
4. Preserve 100% of all existing exports and public API contracts (`getDocuments`, `saveDocuments`, `createDocument`, `updateDocument`, `deleteDocument`, `getDocumentById`, `saveJsonSafe`, etc.) so that `server.js` and existing tests continue to function seamlessly.
5. Verification:
   - Run `node -c dataStore.js` and `node validate_syntax.js` to ensure syntax is clean.
   - Run `node test.js` to verify zero regressions on existing application behavior.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When finished, write your handoff report to:
`c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m1\handoff.md`
And send a completion message back to your parent.
