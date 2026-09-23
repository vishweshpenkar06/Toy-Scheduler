# Quantum Scheduler

Interactive CPU scheduling laboratory. Build workloads (including multi-burst
CPU/I/O processes, deadlines, and tickets), step through execution on an
animated multi-core Gantt timeline, and compare **17 scheduling algorithms**
side by side.

**Stack:** Vite · React 19 · TypeScript (strict) · Vitest · plain CSS  
**Runtime deps:** only `react` and `react-dom`.

---

## Table of contents

- [Quick start](#quick-start)
- [Algorithms](#algorithms)
- [Metrics](#metrics)
- [Multi-core simulation](#multi-core-simulation)
- [Context switches & I/O](#context-switches--io)
- [Features & views](#features--views)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Preset workloads](#preset-workloads)
- [Import / export / share / report](#import--export--share--report)
- [Persistence](#persistence)
- [Project structure](#project-structure)
- [Architecture notes](#architecture-notes)
- [Validation rules](#validation-rules)
- [Testing](#testing)
- [Build tooling](#build-tooling)
- [Design system](#design-system)
- [Contributing notes](#contributing-notes)

---

## Quick start

```bash
npm install
npm run dev       # dev server on http://localhost:5173
npm test          # vitest (watch)
npx vitest run    # single headless run
npm run build     # typecheck + production build to dist/
npm run lint      # eslint
npm run test:ui   # vitest UI
```

---

## Algorithms

All 17 algorithms run through `runAlgorithm(algorithm, processes, options)`
in `src/engine/runAlgorithm.ts`, which dispatches to the event-driven
`SimulationKernel` (policy/mechanism split) with parity coverage against the
legacy `src/engine/scheduler.ts` for the core five algorithms.

**Keys:** `1`–`9` select algorithms 1–9; `Shift+1`…`Shift+8` (`!@#$%^&*`)
select algorithms 10–17.

| # | Key | Name | ID | Preemptive | Notes |
|---|-----|------|----|-----------:|-------|
| 1 | `1` | FCFS | `fifo` | No | Arrival order, PID tie-break. |
| 2 | `2` | SJF | `sjf` | No | Shortest `burstTime` among arrived. |
| 3 | `3` | SRTF | `srtf` | Yes | Preempts on strictly shorter remaining time. |
| 4 | `4` | Round Robin | `roundRobin` | Yes | Quantum slice; lone process runs without pointless fragmentation. |
| 5 | `5` | Priority (NP) | `priorityNonPreemptive` | No | Lower number = higher priority. |
| 6 | `6` | Priority (P) | `priorityPreemptive` | Yes | Preempts on higher priority arrival. |
| 7 | `7` | Priority + Aging | `priorityAging` | Yes | Effective priority promoted while waiting. |
| 8 | `8` | Multilevel Queue | `multiLevelQueue` | No | Fixed priority bands, FIFO per queue. |
| 9 | `9` | MLFQ | `multiLevelFeedback` | Yes | Demotion on exhausted quanta; promotion on wait. |
| 10 | `Shift+1` | HRRN | `hrrn` | No | Highest response ratio next. |
| 11 | `Shift+2` | LRTF | `lrtf` | Yes | Longest remaining time first. |
| 12 | `Shift+3` | Lottery | `lottery` | Yes | Probabilistic share by `tickets`. |
| 13 | `Shift+4` | Stride | `stride` | Yes | Deterministic proportional share (pass values). |
| 14 | `Shift+5` | WFQ | `wfq` | Yes | Weighted fair queuing by virtual finish time. |
| 15 | `Shift+6` | EDF | `edf` | Yes | Earliest absolute `deadline` first. |
| 16 | `Shift+7` | RMS | `rms` | Yes | Static priority by period (rate monotonic). |
| 17 | `Shift+8` | Adaptive RR | `adaptive` | Yes | RR with adaptive quantum / anti-starvation. |

**Shared engine rules**

- Input validated first (`validateProcesses`); throws on duplicate PIDs or
  invalid values.
- Empty workload → zeroed result.
- Deterministic: PID lexicographic tie-break after the primary key.
- Same-timestamp events are batched (priority order: arrival → … →
  terminate), then a single dispatch pass runs.
- RR quantum must be a positive integer; app default is `2`.
- No universal “best algorithm” labeling — comparisons are empirical.

**Event kernel (high level)**

```
EventQueue → PROCESS_ARRIVAL / QUANTUM_EXPIRY / BLOCK / UNBLOCK /
             PREEMPT / CONTEXT_SWITCH_DONE / PROCESS_TERMINATE
                    ↓
            tryDispatchAll()  (per free core)
                    ↓
            policies.ts  selectNext(core, state)
```

---

## Metrics

| Metric | Meaning |
|--------|---------|
| Completion | Max end time of that PID’s slices |
| Response | First slice start − arrival (≥ 0) |
| Turnaround | Completion − arrival |
| Waiting | Turnaround − total CPU burst |
| Throughput | Completions / makespan |
| CPU util | Busy time / (span × cores) × 100 |
| Context switches | Count of CS transitions (from `metrics.contextSwitchCount`) |
| Jain fairness | 1.0 = equal share across processes |
| Wait p50 / p95 | Percentiles of per-process waiting time |
| Deadline misses | Processes finishing after `deadline` (EDF/RMS workloads) |

Stat cards show waiting / turnaround / response / utilization, plus an
extended row (throughput, fairness, CS, wait p95).

---

## Multi-core simulation

True multi-core: the kernel dispatches onto **1–4 cores**. A core in
context-switch or waiting for I/O is not available for dispatch. Timeline
slices carry a `core` field; Gantt renders one track per core. Metrics are
recomputed from the parallel schedule (not copied from single-core).

---

## Context switches & I/O

- **Context-switch cost** — header input (`CS cost`, ms). When > 0 and work
  remains, the kernel inserts a `CONTEXT_SWITCH` slice (pid `"idle"`,
  `kind: "CONTEXT_SWITCH"`) between switches. Gantt shows these blocks.
- **Multi-burst I/O** — optional `process.bursts: { type: 'cpu' | 'io';
  duration }[]`. Validation requires the sequence to end on a CPU burst.
  Blocked processes appear in the READY/BLOCKED board; I/O intervals render
  as `IO` slices on the Gantt. The **io-bursts** preset demonstrates this.

---

## Features & views

Cycle views with the header button or **`C`**:

| View | What it shows |
|------|----------------|
| **Visualizer** | Single algorithm: HUDs, Gantt, playback, decision log, results table, state board, Markdown report export |
| **Benchmark** | All 17 ranked by average waiting time (best flagged) |
| **Race** | All 17 as mini-Gantts on a shared playhead, sorted by makespan |
| **Experiment** | Quantum sweep bar chart + table + CSV export |
| **Learning** | Concept cards for the selected algorithm + live scenario insights |
| **Interview** | 8-question quiz with explanations and scoring |

Also:

- **Playback** — play/pause, step ±1 ms, reset, speed 0.25×–4×, event jump
  buttons and scrubber.
- **State board** — READY / RUNNING / BLOCKED / FINISHED chips at current *t*.
- **Decision log** — algorithm-specific “why this slice?” messages
  (`src/utils/explain.ts`, `decisionLog.ts`).
- **Command palette** — `Ctrl/Cmd+K`: algorithms, views, presets, share,
  report, shortcuts, reset/clear.
- **Workload builder** — add/remove with validation; random generator with
  profiles (`classic` / `io` / `deadline` / `weighted`) via
  `generateWorkload`.
- **9 preset workloads** (below).
- **Sound effects** — Web Audio `soundFx`; header speaker toggle.
- **Onboarding** — first-run tour in `localStorage`.
- **Native `<dialog>`** modals (presets, shortcuts, onboarding).
- **Simulation error banner** for engine exceptions.
- Responsive + `prefers-reduced-motion`.

---

## Keyboard shortcuts

Ignored when focus is in `INPUT`/`TEXTAREA`/`SELECT`/`BUTTON`, or when
Ctrl/Meta/Alt is held (except the palette combo).

| Key | Action |
|-----|--------|
| **Space** | Play / pause |
| **← / →** | Step −1 / +1 ms |
| **R** | Reset playback to t = 0 |
| **C** | Cycle view (all six) |
| **L** | Learning mode |
| **I** | Interview mode |
| **1–9** | Algorithms 1–9 → visualizer |
| **Shift+1–8** | Algorithms 10–17 → visualizer |
| **Ctrl/Cmd + K** | Command palette |
| **?** | Keyboard shortcuts modal |

---

## Preset workloads

`src/data/presets.ts` — selecting a preset also applies its default
algorithm/quantum where set.

| ID | Name | Focus |
|----|------|--------|
| `standard` | Standard Staggered Workload | Classic mixed arrivals |
| `convoy` | Convoy Effect Demonstration | FCFS convoy with one long job |
| `preemption` | SRTF & Priority Preemption Showcase | Mid-run preemption |
| `round-robin` | Round Robin Quantum Slicing | All arrive at t=0 |
| `priority-test` | Priority Scheduling Matrix | Priority bands |
| `io-bursts` | CPU / I/O Burst Workload | BLOCKED + multi-burst timelines |
| `deadline-edf` | Deadline Workload (EDF / RMS) | Deadline misses |
| `lottery-weights` | Weighted Fairness (Lottery / Stride / WFQ) | Tickets & weights |
| `hrrn-mix` | Mixed Burst HRRN Showcase | Response-ratio fairness |

Default app state (no URL/session): `standard`, `fifo`, quantum 2, 1 core.

---

## Import / export / share / report

- **Export workload** — `workload.json` or
  `workload.csv` (`pid,arrivalTime,burstTime,priority`).
- **Import** — `.json` or `.csv` with per-row validation; Confirm disabled
  while errors exist.
- **Share URL** — base64 `?s=` state `{v, p, alg, q, cores}`; schema
  version, 20-process cap, algorithm whitelist from `ALGORITHMS`, re-validate
  on decode; encode refuses URLs > 2000 chars (“Too long”).
- **Markdown report** — “Export Markdown report” in visualizer (or palette
  **Command: Download Markdown report**): config, summary metrics,
  per-process table, workload table. CSV helper `buildResultsCsv` for
  results-only export.

---

## Persistence

Session state (`processes`, algorithm, quantum, cores, CS cost) is saved to
`localStorage['toy-scheduler-session-v1']` on every change and restored on
load (unless a share URL is present). Helpers: `loadSession` / `saveSession`
/ `clearSession` in `src/utils/persistence.ts`.

---

## Project structure

```
Toy Scheduler/
├── index.html, package.json, vite.config.ts, vitest.config.ts,
│   tsconfig.json, eslint.config.mjs
├── README.md, FOLLOWUP.md
├── docs/architecture-audit.md, docs/baseline.md
├── public/
└── src/
    ├── main.tsx, App.tsx, types.ts, index.css
    ├── domain/          # models, validation, bridge (ProcessSpec, bursts)
    ├── engine/          # legacy scheduler.ts, runAlgorithm.ts, metrics.ts
    ├── simulation/      # SimulationKernel, EventQueue, policies, policy,
    │                    #   dataStructures (MinHeap/PQ/Deque)
    ├── data/presets.ts  # 9 presets
    ├── components/      # Header, HUDs, Gantt, Playback, Leaderboard, Race,
    │                    #   ExperimentLab, LearningMode, InterviewMode,
    │                    #   CommandPalette, StateBoard, modals, …
    ├── components/learningContent.ts   # lessons, quiz, scenario insights
    └── utils/           # audio, chartUtils, decisionLog, explain,
                         #   shareUrl, workload, experiment, report,
                         #   persistence
```

---

## Architecture notes

**Data flow:** `App.tsx` owns state → memoized `runAlgorithm(...)` →
`SimulationKernel` → HUDs, Gantt, table, ExplanationBar. Benchmark/Race each
re-run all algorithms (memoized on `[processes, quantum, cores, CS]`).

**Single source of truth:** `ALGORITHMS` in `Header.tsx` drives the header
selector, keyboard mapping, share-URL whitelist, leaderboard/race order, and
palette. `COLORS` is shared by generator/form/presets.

**Policy/mechanism:** kernel handles events, time, cores, CS, I/O;
`policies.ts` only implements `selectNext`. Legacy `scheduler.ts` remains
for parity tests on the core five algorithms.

**Offline-first / no LLM in core:** simulation is pure and deterministic;
no network calls at runtime.

---

## Validation rules

1. PID required, non-empty after trim.
2. `arrivalTime` finite integer ≥ 0.
3. `burstTime` finite integer > 0.
4. Domain layer (`validateProcessSpec`): non-empty burst list, positive
   durations, valid burst types, sequence must end on CPU, deadline ≥
   arrival, positive period/tickets when present.
5. Duplicate PIDs rejected before per-process checks.
6. RR quantum must be a positive integer.

Errors surface as field-level form errors, import dialog rows, or the
simulation error banner.

---

## Testing

**Runner:** Vitest, `globals: true`, `environment: "node"` (shareUrl tests
mock `window`/`location`/`history` on `globalThis`).

**195 tests** across 11 suites:

| Suite | Tests | Themes |
|-------|------:|--------|
| `engine/__tests__/scheduler.test.ts` | 68 | Exact timelines, metrics, determinism, validation, RR anti-fragmentation |
| `domain/__tests__/domain.test.ts` | 19 | Spec validation, bursts, deadlines, tickets, bridge |
| `engine/__tests__/phases.test.ts` | 25 | Phase regressions (CS, I/O, new algorithms) |
| `engine/__tests__/parity.test.ts` | 14 | Kernel vs legacy core algorithms |
| `engine/__tests__/multicore.test.ts` | 14 | No overlap, metrics, utilization ≤ 100% |
| `simulation/__tests__/kernel.test.ts` | 13 | Parity, event order, invariants |
| `simulation/__tests__/eventQueue.test.ts` | 5 | Priority + sequence ordering |
| `simulation/__tests__/dataStructures.test.ts` | 5 | MinHeap etc. |
| `utils/__tests__/shareUrl.test.ts` | 18 | Encode/decode guards |
| `utils/__tests__/workload.test.ts` | 7 | Generator profiles + experiment sweeps (17 algos) |
| `components/__tests__/learning.test.ts` | 7 | Lessons, quiz, report, persistence |

```bash
npx vitest run
```

---

## Build tooling

| Script | Command |
|--------|---------|
| `npm run dev` | `vite` |
| `npm run build` | `tsc && vite build` |
| `npm test` | `vitest` |
| `npm run test:ui` | `vitest --ui` |
| `npm run lint` | `eslint .` |

- TypeScript: ES2020, strict, `jsx: react-jsx`, `noEmit`.
- ESLint flat config: JS + typescript-eslint + react-hooks; ignores `dist`.
- Vite: `@vitejs/plugin-react`, port 5173.

**Full gate (run before commit):**

```bash
npx vitest run; npx tsc --noEmit; npx eslint .; npm run build
```

---

## Design system

`src/index.css` — single light-theme stylesheet: tokens → shell → workspace
→ forms → metrics → transport → Gantt (incl. CS/IO blocks) → state board →
tables → leaderboard → palette → modals → responsive → reduced-motion.

Tokens on `:root`: fonts (Inter + JetBrains Mono), surfaces, borders,
three-step text, accent/green/red/amber (+ soft), radii/shadows, `--ease`.
Breakpoints: tablet ≤960px, mobile ≤640px.

---

## Contributing notes

- Prefer native platform features and existing helpers over new deps.
- New algorithms: add to `AlgorithmType`, `runAlgorithm` case, `ALGORITHMS`
  (updates keys, share whitelist, comparison modes), policy (if kernel), and
  engine tests (timeline + metrics + edge cases).
- New share-visible state → bump `SCHEMA_VERSION` if incompatible.
- Keep `validateProcessInput` / domain validation as the single source of
  truth.
- No LLM or network in the core simulation path.
- Never leave the repo broken: full gate green before commit.
