# Architecture Audit — pre-transformation

Recorded 2026-09-23. Companion to `baseline.md`. Goal of the transformation:
turn this visualizer into an interactive CPU scheduling laboratory
(see MASTER_PLAN.md).

## Current architecture

```
main.tsx → App.tsx (owns ALL state)
              ├─ runAlgorithm(alg, processes, {quantum})   [engine/scheduler.ts]
              ├─ runMultiCore(result, coreCount)           [greedy remap, not real multi-core]
              ├─ Header (ALGORITHMS, COLORS exports)
              ├─ ProcessControlCenter + ReadyQueueHud (sidebar)
              ├─ GanttChart / PlaybackControls / stats / ExplanationBar / ProcessResultsTable
              ├─ AlgorithmLeaderboard | RaceMode (each re-runs all 9 algorithms)
              └─ Presets / Onboarding / KeyboardShortcuts modals (native <dialog>)
```

### Data flow

1. `App.tsx` holds: `processes`, `algorithm`, `quantum`, `coreCount`, `viewMode`,
   playback (`isPlaying`, `currentTimeStep`, `playbackSpeed`), UI modals, `simError`.
2. `useMemo` → `runAlgorithm` → `runMultiCore` → single `SimulationResult`.
3. A second `useEffect` re-runs the engine only to catch errors into `simError`.
4. Components consume the result; leaderboard/race each call `runAlgorithm` × 9.

### Engine (`src/engine/scheduler.ts`, 874 lines)

- Single dispatcher `runAlgorithm` switch over 9 algorithms.
- Each algorithm: validate → event loop building `TimelineSlice[]` → `calculateMetrics`.
- Timeline model: `{ pid, start, end, core? }`; idle slices synthesized for display only.
- Anti-fragmentation: RR/SRTF lone-process continuous run (regression-tested).
- **Multi-core = greedy slice remap** of single-core order; metrics passed through
  unchanged. This is the P0 problem called out in MASTER_PLAN §3.

### Algorithms (9)

`fifo, sjf, srtf, roundRobin, priorityNonPreemptive, priorityPreemptive,
priorityAging, multiLevelQueue, multiLevelFeedback` — all in one file, no policy
interface, algorithm options hard-coded inside `runAlgorithm` except quantum.

### UI structure

- Single route, three view modes toggled in-state (`visualizer | comparison | race`).
- One stylesheet `src/index.css` (light theme, CSS variables, responsive, reduced-motion).
- No router, no sidebar navigation, no dashboard, no experiment lab.

### State ownership

All in `App.tsx` (~346 lines): workload, algorithm, cores, playback, sound,
modals, share, error. No `src/state/` split yet.

### Tests

- 86 tests: exact timeline equality, metrics, determinism, validation,
  anti-fragmentation regressions, multi-core no-overlap, share-URL schema.
- Environment: node (not jsdom); browser APIs mocked.

## Technical debt

1. **Fake multi-core** — remap + pass-through metrics (correctness lie, P0).
2. **No policy/mechanism split** — each algorithm is a bespoke simulator loop;
   adding HRRN/EDF/etc. would mean copy-pasting the loop.
3. **No event model** — no inspectable event trace, no structured explanations
   (decision log is string-only, generated post-hoc from slices).
4. **Single-burst process model** — no I/O, no process states, no context-switch cost.
5. **`App.tsx` god component** — all state and three modes.
6. **Lint baseline broken** — 7 errors (see baseline.md); one real rules-of-hooks bug.
7. **Algorithm metadata lives in `Header.tsx`** — a component exports domain data
   (`ALGORITHMS`, `COLORS`); share-URL whitelist depends on it.
8. **Metrics module is private** inside scheduler — no fairness, throughput,
   percentiles, context-switch counts.
9. **No persistence** beyond `localStorage['toy-scheduler-onboarded']` and URL state.
10. **Leaderboard/Race re-run all algorithms per render memo** — fine at 4 processes,
    will not scale to experiment lab / 1000-process stress runs.

## Risks

| Risk | Mitigation |
|------|------------|
| Rewriting engine breaks 86 tests | Keep old engine tests as regression suite; migrate algorithms one-by-one (Phase 4) |
| Semantic drift when changing algorithm behavior | Document every semantic change; golden-file compare old vs new per algorithm |
| Scope explosion (34 phases) | Strict phase order; gate `vitest + tsc + lint + build` after each phase |
| Multi-core rewrite invalidates old multi-core tests | Replace remap tests with true-parallel invariant tests |
| URL schema break | `SCHEMA_VERSION` 1→2 with v1→v2 migration |

## Migration plan (summary of MASTER_PLAN phases)

| Phase | Deliverable |
|-------|-------------|
| 0 | This audit + baseline + green gates |
| 1 | Domain layer: ProcessState, bursts, spec/runtime types |
| 2 | Discrete-event kernel + event queue |
| 3 | `SchedulerPolicy` interface |
| 4 | Migrate 9 algorithms, keep tests green |
| 5 | True multi-core (per-core state, metrics recomputed) |
| 6 | Context-switch cost in timeline + metrics |
| 7 | CPU/I/O bursts + BLOCKED state + state board |
| 8 | HRRN, LRTF, Lottery, Stride, WFQ, EDF, RMS, Adaptive |
| 9 | MinHeap / PriorityQueue / Deque / EventQueue |
| 10 | Metrics engine (throughput, fairness, tails, deadlines) |
| 11 | Structured explainability |
| 12–15 | UI shell, workspace, Gantt 2.0, playback 2.0 |
| 16–17 | Workload builder + generator |
| 18–20 | Experiment lab, sensitivity, Monte Carlo |
| 21–23 | Learning, interview mode, command palette |
| 24–26 | IndexedDB persistence, sharing, reports |
| 27–34 | Optional AI, a11y, testing, polish, docs, final verify |
