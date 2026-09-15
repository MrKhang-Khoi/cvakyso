## 2026-09-14T23:49:00Z

Explorer 3 (Concurrency, Load Testing & Data Integrity Specialist) for the EduSign VGCA system.
Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_survey_3
Authoritative request: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md

Mission:
Explore the concurrency handling, signing endpoints, dataStore mechanics, and existing test suites (especially in server.js, dataStore.js, pdfSignerService.js, package.json, test.js, tests/) to investigate requirement R3: Real-time load test with 50 concurrent teachers signing simultaneously.
Specifically investigate and document:
1. Signature and submission endpoints:
   - What exact API endpoints handle lesson plan submission, digital signing, and status updates?
   - How does pdfSignerService.js perform PDF signing? Is it CPU-intensive, asynchronous, or blocking?
2. DataStore concurrency & race condition risks:
   - How does dataStore.js read and write to documents.json and in-memory caches?
   - Are there mutexes, file locks, or queuing mechanisms to prevent race conditions and Lost Updates when 50 concurrent requests arrive within 5-10 seconds?
3. Metrics & Monitoring:
   - How to measure success rate (>= 98%), latency (average and P95), and event loop lag / server resource usage during the 50-teacher burst?
   - How to perform the post-test data integrity audit on documents.json and cache to verify 0 lost updates?
4. Existing test infrastructure:
   - What tools and libraries are installed in package.json (Playwright, Jest, autocannon, artillery, etc.)?
   - Recommendations for building the 50-concurrent-teacher stress test harness.
