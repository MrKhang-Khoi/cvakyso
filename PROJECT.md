# Project: EduSign VGCA Multi-Agent Verification & Testing System

## Architecture
- **Frontend Layer**: Vanilla HTML5/Tailwind/ES6 in `index.html` and `portal-baocao.html`. Incorporates 18 dialog/modal components, PDF.js canvas viewer, drag-and-drop coordinate mapping (72 DPI points), USB Token alerts, and School Seal placement.
- **Application Server Layer**: Node.js Express in `server.js` (port 3000 / TEST_PORT). Serves REST APIs for document lifecycle (`POST /api/documents`, `sign-vgca-real`, `sign-step`, `approve-principal`, `reject`, `recall`), authentication (`requireAuth`), and cloud backups.
- **Signing & Cryptography Layer**: `pdfSignerService.js` utilizing `pdf-lib` for visual and PAdES-compliant embedding, coupled with native C# agent bridges (`RealPdfSigner.exe` / `EduSign_Agent.exe`).
- **Data Persistence Layer**: `dataStore.js` managing JSON-based document storage in `data/documents.json` with in-memory caching (`_docsCache`).
- **Cloud Synchronization Layer**:
  - Google Drive Kho trường (`googleDriveService.js`) via Google Apps Script Webhook.
  - Microsoft OneDrive (`oneDriveService.js`) for local Windows sync.
  - Firebase Realtime Database (`firebase-config.js`) for metadata replication.
- **Test Infrastructure**: Playwright (`@playwright/test`), native Node.js `perf_hooks`, custom HTTP test harnesses in `tests/`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Login & Auth Error Modal | `#viewLogin`, `#loginAlert`, `#modalVgcaLogin`, `#modalAdminAuth`, locked account handling | M2 | Explorer 1 |
| 2 | Lesson Plan Submission & Drag-Drop Signature | `#teacherFileInput`, `#btnSignNow`, `#modalDocViewer`, `#draggableSignatureStamp`, 72 DPI PDF coordinates | M2 | Explorer 1 |
| 3 | USB Token Warning Dialog | `#modalUnifiedAlert` (z-[110]) wrong token, missing token, locked account, agent offline | M2 | Explorer 1 |
| 4 | School Seal Confirmation Dialog | `#modalBghConfig`, `#btnToggleSealPlacement`, 105pt red seal placement for Principal approval | M2 | Explorer 1 |
| 5 | Rejection Dialog | `#modalRejectDocument`, `#textareaRejectReason`, quick-fill pills, return workflow | M2 | Explorer 1 |
| 6 | Dual Viewport Responsiveness | 1920x1080 (Desktop) and 1366x768 (Laptop), 0 horizontal overflow traps (`scrollWidth === clientWidth`) | M2 | Explorer 1 |
| 7 | Zero Console Errors | 0 F12 console runtime errors and 0 unhandled promise rejections during modal interactions | M2 | Explorer 1 |
| 8 | Modal Latency Compliance | Modal open time and CSS transitions < 300ms | M2 | Explorer 1 |
| 9 | Ephemeral Filesystem Risk Audit | Empirical assessment of Render Free/Starter ephemeral disk reset upon sleep/restart/redeploy | M3 | Explorer 2 |
| 10 | Cloud Sync & Recovery Verification | Audit of Google Drive backup, Firebase RTDB metadata sync, and OneDrive behavior across container lifecycle | M3 | Explorer 2 |
| 11 | DataStore Concurrency Hardening | Async serialized write queue in `dataStore.js` to eliminate `Atomics.wait` event loop freezes and prevent lost updates | M1 | Explorer 3 |
| 12 | 50 Concurrent Teachers Burst Harness | 50 simultaneous teacher signature requests submitted within 5-10s window | M4 | Explorer 3 |
| 13 | Load Test Performance Metrics | Measurement of Success Rate (>= 98%), Average Latency, P95 Latency, Event Loop Lag (`monitorEventLoopDelay`) | M4 | Explorer 3 |
| 14 | Post-Test Data Integrity Audit | Automated audit of `documents.json` and cache verifying exactly 50 records created, 0 lost updates | M4 | Explorer 3 |
| 15 | Multi-Agent Independent Verification & Audit | Independent Review, Challenger stress-test, and Forensic Integrity Audit (`teamwork_preview_auditor`) | M5 | Prompt |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | DataStore Concurrency Hardening | Implement robust async write queue / atomic protection in `dataStore.js` to ensure zero lost updates under concurrency | none | DONE |
| M2 | R1: UI & Dialog Supervision Suite | Implement and execute Playwright test suite for all 5 dialogs at 1920x1080 and 1366x768, 0 console errors, 0 overflow | none | DONE |
| M3 | R2: Render Cloud Storage Verification | Implement and execute empirical probe suite verifying Render ephemeral disk risks, container reset, and Cloud sync | none | DONE |
| M4 | R3: 50-Teacher Real-Time Load Test | Execute 50 concurrent teacher load test, measure latency/event loop lag, verify >= 98% success rate and 0 lost updates | M1 | PLANNED |
| M5 | Final Forensic Audit & Verification | Run independent reviewer, adversarial challenger, and forensic auditor for complete integrity verification | M2, M3, M4 | PLANNED |

## Interface Contracts
### `server.js` ↔ `dataStore.js`
- `createDocument(docData)` -> returns new document object with generated `id`, persists to memory cache and schedules atomic disk write.
- `updateDocument(id, updates)` -> updates document fields in memory cache and schedules atomic disk write.
- `getDocuments(forceReload)` -> returns array of all documents. When `forceReload` is true, re-reads disk safely without corrupting pending queue.
- `saveDocuments(docs)` -> must queue write operation asynchronously without blocking event loop via `Atomics.wait`.

### `test_harness` ↔ `server.js`
- Port: Dedicated test port (e.g. 3001) or existing server instance on port 3000.
- Endpoints exercised:
  - `POST /api/documents` (Payload: JSON containing document metadata, PDF base64 / mock base64, signature image, coordinates).
  - `POST /api/documents/:id/sign-vgca-real`.
  - `POST /api/documents/:id/approve-principal`.
  - `POST /api/documents/:id/reject`.
- Headers: `x-user-id`, `x-user-username`, `Content-Type: application/json`.

## Code Layout
- Test Suites:
  - `tests/ui_dialog_supervision.spec.mjs`: Playwright browser test suite for R1 (dialogs, viewports, console errors, overflow traps).
  - `tests/render_storage_verification.mjs`: Node.js test script for R2 (Render cloud storage, ephemeral disk, cloud sync probes).
  - `tests/stress_50_teachers_load_test.mjs`: Node.js load test harness for R3 (50 concurrent teachers, latency, event loop delay, data integrity audit).
- Code Modifications:
  - `dataStore.js`: Async serialized disk queue to eliminate event loop blocking during concurrent writes.
- Agent Workspace Metadata:
  - `.agents/teamwork_preview_orchestrator_1/`: Orchestrator state (`BRIEFING.md`, `plan.md`, `progress.md`, `GATE_STATUS.md`, `DEAD_ENDS.md`).
  - `.agents/worker_m1/`, `.agents/worker_m2/`, etc.: Working directories for dispatched workers and reviewers.
