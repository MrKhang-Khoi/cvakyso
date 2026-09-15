# Project Plan: EduSign VGCA Multi-Agent Testing & Verification System

## Objectives
1. Map and index the EduSign VGCA codebase, verify/ensure CodeGraph initialization.
2. R1: Multi-Agent UI & Dialog Supervision via Playwright at 1920x1080 and 1366x768 across all interactive dialogs/modals (login, submission, token warning, school seal, rejection), 0 F12 console errors, 0 horizontal overflow traps.
3. R2: Empirical verification of Render cloud storage mechanism (ephemeral disk analysis, simulated/actual container lifecycle, sync mechanisms with Google Drive, OneDrive, Firebase Realtime Database).
4. R3: Real-time load test with 50 concurrent teachers signing simultaneously (5-10s burst), >= 98% success rate, latency measurement, event loop lag analysis, and strict data integrity audit in documents.json / cache (0 lost updates).
5. Comprehensive Forensic Audit & Verification.

## Phases
- **Phase 0: Survey & Codebase Exploration**
  - Explorer 1: Frontend architecture, dialog modals, UI components, PDF viewer, token warnings, school seal.
  - Explorer 2: Backend architecture, Render server config, file storage paths (uploads, documents.json, cache), Cloud sync (Drive/OneDrive/Firebase).
  - Explorer 3: Existing test suites, load test requirements, concurrency handling, race condition potential in documents.json.
- **Phase 1: Architecture & Scope Formulation (PROJECT.md)**
  - Synthesize Explorer findings into Feature Inventory & Milestones.
  - Establish CodeGraph & test runner prerequisites.
- **Phase 2: R1 - UI & Dialog Browser Supervision**
  - Implement and run headless Playwright test scripts across 1920x1080 and 1366x768.
  - Test all 5 modal workflows: Login/Auth errors, Lesson plan submission + PDF drag-drop signature, USB Token warning, Principal school seal, Rejection modal.
  - Assert 0 console errors, 0 overflow traps, modal open latency < 300ms.
  - Review, Challenge, Audit.
- **Phase 3: R2 - Render Cloud Storage Empirical Verification**
  - Investigate and execute empirical test script on Render filesystem behavior.
  - Test ephemeral container reset behavior, identify lost files vs persisted records.
  - Evaluate Google Drive / OneDrive / Firebase synchronization fallback.
  - Review, Challenge, Audit.
- **Phase 4: R3 - 50 Concurrent Teachers Stress & Load Test**
  - Implement load test harness executing 50 simultaneous teacher signature requests within 5-10s burst.
  - Measure Success Rate (>= 98%), Avg/P95 Latency, Event Loop lag, CPU/RAM impact.
  - Audit documents.json & cache integrity: verify exactly 50 records, 0 lost updates, 0 corrupted writes.
  - Review, Challenge, Audit.
- **Phase 5: Forensic Integrity Audit & Synthesis**
  - Forensic Auditor executes full integrity checks across all 3 requirements.
  - Synthesis and final presentation of results, latency metrics, and evidence.
