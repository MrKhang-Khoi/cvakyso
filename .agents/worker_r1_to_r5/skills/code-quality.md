---
name: code-quality
description: Enforces strict code quality standards to eliminate guesswork and prevent bugs. MUST be followed for ALL code changes. Covers verification, error handling, data integrity, and anti-guessing rules. Use this skill ALWAYS when writing, modifying, or reviewing any code.
---

# Code Quality & Anti-Guessing Protocol

## ⛔ ABSOLUTE RULES — NEVER BREAK THESE

### Rule 1: NEVER Guess Code — ALWAYS Verify
Before writing ANY code that references existing functions, variables, DOM elements, or APIs:

1. **READ the actual source file** to see the current state
2. **SEARCH for the exact function/variable name** to understand its signature
3. **VERIFY DOM element IDs** exist in the HTML before referencing them
4. **CHECK API endpoints** are correct and match backend expectations
5. **CONFIRM data structures** match between frontend and backend

❌ **NEVER** write code based on memory or assumptions about what exists
✅ **ALWAYS** verify by reading the actual source code first

### Rule 2: NEVER Leave Error Handling Incomplete
Every async operation MUST have:
```javascript
try {
  // operation
} catch (error) {
  console.error('[ModuleName] Operation failed:', error);
  // User-facing error feedback (alert, toast, UI indicator)
}
```

### Rule 3: NEVER Create Orphan Event Listeners
- Every `addEventListener` must have a corresponding `removeEventListener` path
- Firebase `.on()` listeners must have `.off()` cleanup on logout/navigation
- `setInterval`/`setTimeout` must be tracked and cleared

### Rule 4: NEVER Introduce Race Conditions
- Snapshot IDs/values BEFORE async operations
- Use `const` to capture values that might change during await
- Debounce rapid-fire events (input, scroll, resize)

## 📋 Pre-Code Checklist (MANDATORY)

Before writing ANY code change, verify:

```
CONTEXT LOADING:
- [ ] Read the file(s) I'm about to modify
- [ ] Understand the current state of affected functions
- [ ] Identify all callers of functions I'm changing
- [ ] Check for related CSS that may be affected

LOGIC VERIFICATION:
- [ ] My variable/function names match exactly what exists
- [ ] My DOM selectors match actual HTML element IDs/classes
- [ ] My Firebase paths match the database structure
- [ ] My API endpoints match backend routes
- [ ] My data shapes match what the backend returns

IMPACT ANALYSIS:
- [ ] This change won't break existing functionality
- [ ] Error states are handled gracefully
- [ ] Loading states are shown during async operations
- [ ] Edge cases are considered (empty data, null values, network failure)
```

## 📋 Post-Code Checklist (MANDATORY)

After writing ANY code change, verify:

```
CODE CORRECTNESS:
- [ ] No syntax errors (matching brackets, quotes, semicolons)
- [ ] No undefined variables or functions
- [ ] No duplicate event listeners
- [ ] No memory leaks (uncleaned intervals, listeners)

LOGIC CORRECTNESS:
- [ ] Data flows correctly from input → processing → output
- [ ] Conditional branches cover all cases (if/else, switch default)
- [ ] Loops have proper exit conditions
- [ ] Async operations handle both success AND failure

UI CORRECTNESS:
- [ ] New UI elements have proper CSS styling
- [ ] Buttons/inputs are accessible and focusable
- [ ] Loading/error/empty states are handled
- [ ] Layout doesn't break on different screen sizes
```

## 🔍 Code Review Standards

When reviewing code, check for:

### JavaScript
- Undeclared variables (use `const`/`let`, never `var`)
- Missing `await` on async operations
- Uncaught promise rejections
- Type coercion issues (`==` vs `===`)
- Off-by-one errors in loops/arrays
- Missing null checks before property access

### HTML
- Missing closing tags
- Duplicate IDs (must be unique)
- Missing `alt` attributes on images
- Form inputs without labels
- Inline styles that should be in CSS

### CSS
- Missing vendor prefixes for cross-browser support
- Z-index conflicts
- Overlapping/conflicting selectors
- Missing responsive breakpoints
- Unused CSS rules

## 🛡 Firebase-Specific Rules

1. **Always use `.set()` with error handling:**
   ```javascript
   await ref.set(data).catch(err => {
     console.error('[Firebase] Save failed:', err);
     alert('Lưu dữ liệu thất bại. Vui lòng thử lại.');
   });
   ```

2. **Snapshot IDs before async:**
   ```javascript
   const currentId = activeExerciseId; // Snapshot
   const result = await someAsyncOp();
   if (currentId !== activeExerciseId) return; // Stale check
   ```

3. **Clean up listeners on logout:**
   ```javascript
   function cleanup() {
     listeners.forEach(ref => ref.off());
     listeners = [];
   }
   ```

4. **Validate data before saving:**
   ```javascript
   if (!data || typeof data !== 'object') {
     console.error('[Validate] Invalid data:', data);
     return;
   }
   ```
