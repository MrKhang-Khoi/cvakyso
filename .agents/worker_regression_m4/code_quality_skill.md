# Code Quality & Anti-Guessing Protocol (Local Copy)

## ⛔ ABSOLUTE RULES — NEVER BREAK THESE

### Rule 1: NEVER Guess Code — ALWAYS Verify
Before writing ANY code that references existing functions, variables, DOM elements, or APIs:
1. READ the actual source file to see the current state
2. SEARCH for the exact function/variable name to understand its signature
3. VERIFY DOM element IDs exist in the HTML before referencing them
4. CHECK API endpoints are correct and match backend expectations
5. CONFIRM data structures match between frontend and backend

### Rule 2: NEVER Leave Error Handling Incomplete
Every async operation MUST have try/catch blocks with proper error logging and user feedback.

### Rule 3: NEVER Create Orphan Event Listeners
Every listener must have cleanup.

### Rule 4: NEVER Introduce Race Conditions
Snapshot IDs/values before async operations.
