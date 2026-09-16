# FOLLOWUP — Items Needing New Features

These items were identified during the Verification & Hardening Pass but require
new features or significant design changes to fix properly. They are tracked here
for future work.

## P1 — High Priority

### 1. Error banner for simulation failures (Phase 1, Item 3)
**DONE.** `simError` state added to App.tsx. Visible error banner with dismiss button renders at top of visualizer view when simulation throws.

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
**DONE.** `validateImport()` returns per-row `ImportError` objects with row number and field. Confirmation dialog shows all errors as a scrollable list.

### 5. Import confirmation dialog (Phase 2, Item 15)
**DONE.** `pendingImport` state holds parsed processes before committing. Confirmation dialog shows process count, current workload size, per-row validation errors, duplicate PIDs, and Confirm/Cancel buttons. Confirm is disabled when validation errors exist.

### 6. simError state + error banner (Phase 1, Item 3)
**DONE.** `simError` state in App.tsx catches simulation errors from `runAlgorithm`/`runMultiCore`. Error banner renders at top of main content with a dismiss button.

### 7. URL length graceful degradation (Phase 2, Item 12)
**DONE.** `encodeStateToURL` returns `null` when encoded URL exceeds 2000 chars (browser practical limit). `handleShare` shows "Too long" on the share button for 3 seconds. Also fixed `parseJSON` `Number() || 0` falsy-value bug (zeroes were coerced to defaults).

## P3 — Low Priority

### 8. Race mode performance measurement (Phase 5, Item 28)
The memoization fix resolved the per-tick recomputation, but with a max-size
workload (20 processes) on 9 algorithms, initial computation could be slow.
Should measure and consider virtualizing the race view.

### 9. Historical docs consolidation (Phase 7, Item 34)
`ENGINE_SUMMARY.md`, `FIXES_COMPLETED.md`, and `RR_FRAGMENTATION_FIX.md`
were consolidated/updated in this pass but remain as separate files.
Could be merged entirely into `README.md` with a single source of truth.
