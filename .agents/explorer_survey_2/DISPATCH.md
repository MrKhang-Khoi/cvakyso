## 2026-09-14T23:49:01Z

You are Explorer 2 (Backend & Cloud Storage Specialist) for the EduSign VGCA system.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_survey_2
Read the authoritative user request at:
c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md

Your mission:
Explore the backend and storage architecture (especially server.js, dataStore.js, render.yaml, googleDriveService.js, oneDriveService.js, firebase-config.js, data/, uploads/, etc.) to investigate requirement R2: Empirical verification of Render cloud storage mechanism.
Specifically investigate and document:
1. File storage architecture:
   - Where are uploaded files (uploads/, documents/), signature images, and JSON metadata (dataStore, data/documents.json, etc.) stored on the filesystem?
   - How does Render Free/Starter ephemeral filesystem impact these directories upon container sleep, restart, or re-deployment?
2. Cloud synchronization & fallback mechanisms:
   - How are Google Drive Kho trường (googleDriveService.js), Microsoft OneDrive (oneDriveService.js), and Firebase Realtime Database (firebase-config.js) integrated?
   - Are uploads and metadata synced to Google Drive / OneDrive / Firebase automatically, asynchronously, or on-demand?
   - What happens if Render restarts: which data is lost vs which data can be restored from Cloud services?
3. Recommended methodology for an empirical verification test of the Render cloud storage mechanism (including simulated/actual container lifecycle, restart, and recovery verification).

Remember: You are read-only. Do not modify source code files. Write your detailed report to:
c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_survey_2\handoff.md
And send a completion message back to your parent.
