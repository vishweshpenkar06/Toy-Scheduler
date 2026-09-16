# FOLLOWUP — Items Needing New Features

These items were identified during the Verification & Hardening Pass but require
new features or significant design changes to fix properly. They are tracked here
for future work.

## P1 — High Priority

### 1. Error banner for simulation failures (Phase 1, Item 3)
The `simError` state and error banner were never implemented. Currently,
`runAlgorithm` failures silently return `EMPTY_RESULT` with only a `console.error`.
A visible error state + banner component is needed to surface engine errors to
the user (e.g., invalid quantum, unexpected algorithm failure).

### 2. Modal focus management (Phase 1, Item 4)
None of the three modals (Presets, Shortcuts, Onboarding) implement proper
focus trapping, autofocus on open, or focus restoration on close. A shared
`useModal` hook should handle: Escape key, autofocus first focusable element,
trap Tab within modal, restore previous focus on close.

### 3. AlgorithmLeaderboard not memoized correctly (Phase 1, Item 6)
Fixed to use `useMemo` in this pass, but the component still runs 9 algorithm
simulations on every render. Should consider a web worker or lazy computation
for very large workloads.

## P2 — Medium Priority

### 4. CSV/JSON import per-row error reporting (Phase 2, Item 13)
Currently shows only the first error. Should show per-row error messages
with row numbers and specific field issues (like a linting report).

### 5. Import confirmation dialog (Phase 2, Item 15)
Import silently replaces the current workload. Should show a preview diff
or confirmation prompt before committing, especially for large imports.

### 6. simError state + error banner (Phase 1, Item 3)
`src/App.tsx` has a try/catch that only does `console.error`. Needs a
`simError` state variable and a visible error banner component.

### 7. URL length graceful degradation (Phase 2, Item 12)
The permalink has no explicit URL length cap. For very large workloads
(20 processes × ~50 chars), the base64 string could approach browser limits.
Should show a warning or truncate gracefully.

## P3 — Low Priority

### 8. Race mode performance measurement (Phase 5, Item 28)
The memoization fix resolved the per-tick recomputation, but with a max-size
workload (20 processes) on 9 algorithms, initial computation could be slow.
Should measure and consider virtualizing the race view.

### 9. Historical docs consolidation (Phase 7, Item 34)
`ENGINE_SUMMARY.md`, `FIXES_COMPLETED.md`, and `RR_FRAGMENTATION_FIX.md`
were consolidated/updated in this pass but remain as separate files.
Could be merged entirely into `README.md` with a single source of truth.
