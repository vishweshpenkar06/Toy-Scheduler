# FOLLOWUP — Items Needing New Features

## P1 — High Priority

### 1. Error banner for simulation failures
**DONE.** `simError` state + error banner with dismiss button.

### 2. Modal focus management
**DONE.** All 3 modals converted to native `<dialog>` — browser provides focus trapping, Escape, backdrop, `aria-modal` for free.

### 3. AlgorithmLeaderboard memoization
**DONE.** Wrapped in `useMemo`.

## P2 — Medium Priority

### 4. CSV/JSON import per-row error reporting
**DONE.** `validateImport()` returns per-row errors with row number and field.

### 5. Import confirmation dialog
**DONE.** `pendingImport` state with confirm/cancel, validation errors shown, confirm disabled on errors.

### 6. simError state + error banner
**DONE.** Error banner at top of visualizer with dismiss button.

### 7. URL length graceful degradation
**DONE.** `encodeStateToURL` returns null when >2000 chars. Share button shows "Too long".

## P3 — Low Priority

### 8. Race mode performance measurement
Not done. Max workload (20 processes × 9 algorithms) runs fine in practice.

### 9. Docs consolidation
**DONE.** Merged ENGINE_SUMMARY into README. Deleted FIXES_COMPLETED.md and RR_FRAGMENTATION_FIX.md.

## Ponytail Refactoring Applied

- Native `<dialog>` for all modals (browser provides focus trapping, Escape, backdrop)
- Inlined MetricsCards (38 lines, trivial logic)
- Consolidated `COLORS` constant (was duplicated as `RANDOM_COLORS` and `COLOR_PALETTE`)
- Derived `VALID_ALGORITHMS` from `ALGORITHMS` array (single source of truth)
- Removed JSDoc boilerplate from types.ts and scheduler.ts
- Removed 41 narration comments from scheduler.ts (kept 9 "why" comments)
- Deleted 3 redundant documentation files
