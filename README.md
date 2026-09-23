# Quantum Scheduler

Interactive CPU scheduling algorithm visualizer and performance lab. Build
workloads, step through execution on an animated Gantt timeline, and compare
9 scheduling algorithms side by side — including multi-core simulation up to
4 cores.

**Stack:** Vite · React 19 · TypeScript (strict) · Vitest · plain CSS

---

## Table of contents

- [Quick start](#quick-start)
- [Algorithms](#algorithms)
- [Metrics](#metrics)
- [Multi-core simulation](#multi-core-simulation)
- [Features](#features)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Preset workloads](#preset-workloads)
- [Import / export / share](#import--export--share)
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
npm test          # run the full test suite
npm run build     # typecheck + production build to dist/
npm run lint      # eslint
npm run test:ui   # vitest UI
```

Runtime dependencies are only `react` and `react-dom`. Everything else
(Vite, TypeScript, Vitest, ESLint) is dev tooling.

---

## Algorithms

All 9 algorithms live in `src/engine/scheduler.ts` behind the
`runAlgorithm(algorithm, processes, options)` dispatcher. Keyboard keys
`1`–`9` map to the table order below.

| # | Key | Name | ID | Preemptive | Behavior |
|---|-----|------|----|-----------:|----------|
| 1 | `1` | FCFS | `fifo` | No | First-Come First-Served. Sorts by arrival (PID tie-break), runs each process to completion in one slice, jumps time forward when idle. |
| 2 | `2` | SJF | `sjf` | No | Shortest Job First. Among arrived processes, picks the shortest `burstTime` (PID tie-break), runs to completion. |
| 3 | `3` | SRTF | `srtf` | Yes | Shortest Remaining Time First. Preempts only when an arriving process has **strictly** shorter remaining time (or equal remaining + lexicographically smaller PID). Event-driven slicing avoids unnecessary fragmentation. |
| 4 | `4` | Round Robin | `roundRobin` | Yes | FIFO ready queue, slice = `min(quantum, remaining)`. A **lone** process runs continuously until the next arrival or completion (anti-fragmentation). Unfinished processes re-enqueue after new arrivals are admitted. |
| 5 | `5` | Priority (NP) | `priorityNonPreemptive` | No | Runs the highest-priority arrived process to completion. **Lower number = higher priority**; missing priority = lowest (`Number.MAX_SAFE_INTEGER`); PID tie-break. |
| 6 | `6` | Priority (P) | `priorityPreemptive` | Yes | Same selection, but stops the current process when an arrival has strictly higher priority (lower number) or equal priority + smaller PID. |
| 7 | `7` | Priority + Aging | `priorityAging` | Yes | Maintains an `effectivePriority` per process. Every `agingInterval` (default **3**) time units, a waiting arrived process's priority is reduced by `agingAmount` (default **1**, floored at 0 — i.e. promoted). The current slice also stops at the next pending aging tick so promotions are reconsidered. |
| 8 | `8` | Multilevel Queue | `multiLevelQueue` | No | Processes are assigned **once** to a queue by priority band, then always served FIFO from the first non-empty queue (strict queue-level priority, runs to completion). Default bands: **System** pri 0–1, **Interactive** pri 2–3, **Batch** pri 4+. |
| 9 | `9` | MLFQ | `multiLevelFeedback` | Yes | New processes enter **level 0**. Each level runs with its own quantum (default **[2, 4, 8]**). After `demotionThreshold` (**2**) exhausted slices a process is demoted one level; any process waiting ≥ `agingPromotionInterval` (**10**) since last service is promoted one level before dispatch. |

**Shared engine rules**

- Every algorithm validates input first (`validateProcesses`) and throws on
  duplicate PIDs or invalid values.
- Empty workload → zeroed result (no timeline, all averages 0).
- Deterministic everywhere: PID lexicographic tie-break after the primary key.
- The engine does not emit idle slices; idle jumps advance the clock to the
  next arrival. Idle gaps are synthesized for display by the multi-core pass
  and Gantt chart.
- Round Robin quantum must be a positive integer, else it throws
  `Invalid quantum: must be a positive integer, got X`. The app default is
  `quantum = 2` (engine fallback when none is passed is `1`).

---

## Metrics

Per-process metrics are computed in `calculateMetrics` from the timeline
(idle slices ignored):

| Metric | Formula |
|--------|---------|
| Completion time | `max(end)` over all slices with that PID |
| Response time | `max(0, firstSliceStart − arrivalTime)` |
| Turnaround time | `completionTime − arrivalTime` |
| Waiting time | `turnaroundTime − burstTime` |
| Averages | arithmetic mean of each metric across all processes |

The four stat cards show **Avg waiting**, **Turnaround**,
**Response**, and **CPU utilization** (`busy / (totalSpan × coreCount) × 100`).
The per-process table shows arrival, burst, completion, turnaround, waiting,
and response for every PID.

---

## Multi-core simulation

`runMultiCore(singleCoreResult, coreCount)` remaps the single-core timeline
onto **1–4 cores** (values outside that range are clamped):

1. The single-core slice **order** is preserved — it represents a global
   ready-queue ordering of scheduling decisions.
2. Each non-idle slice is dispatched greedily to the core that **becomes
   free earliest** (first minimum wins, core 0 on ties). Start time is
   `max(originalStart, coreFreeAt[bestCore])`; duration is preserved; a
   `core` field is assigned.
3. Idle slices are pinned to **core 0** (idle gaps are global).
4. `coreCount <= 1` or an empty timeline returns the input unchanged —
   single-core results are byte-identical to the original single-core run.

**Important:** process metrics (waiting/turnaround/response and the
averages) are **passed through unchanged from the single-core run** — the
multi-core pass only remaps the timeline; it does not recompute metrics for
the parallel schedule. CPU utilization, however, is core-adjusted.

---

## Features

- **Animated Gantt timeline** — per-core tracks, synthesized idle gaps,
  nice axis ticks (1/2/2.5/5/10 mantissa steps), hover + pin tooltips,
  playback playline, active-slice highlight, legend, focusable/aria-labeled
  blocks.
- **Playback** — play/pause, step ±1 ms, reset, current/max readout, speed
  0.25×–4×. Animation interval is `max(80, 450 / speed)` ms per tick.
  Playback auto-resets when processes/algorithm/quantum change, auto-stops
  at the end, and restarting at the end restarts from 0.
- **Three view modes** — `visualizer` (default), `comparison` (leaderboard
  of all 9 ranked by average waiting time, best flagged within 0.001), and
  `race` (all 9 as mini-Gantt tracks on a shared axis and playhead, sorted
  by total makespan, with "Fastest" badges and per-row stats: total, avg
  wait, CPU util, slice count ≈ context switches). Cycle with `C`.
- **Decision log / "Why?" bar** — `generateDecisionLog()` produces a
  human-readable message per slice with algorithm-specific phrasing (FCFS
  queue order, SJF "shortest job", SRTF preemption, RR quantum expiry,
  priority preemption, aging promotions, MLQ/MLFQ queue selection,
  "CPU idle"). The ExplanationBar shows the message for the current time
  step (falling back to the latest).
- **Workload builder** — add/remove processes with field-level validation,
  simple random generator (4–6 processes), custom random generator sliders
  (2–12 processes, burst 1–10/2–20, arrival spread 1–20), reset to default,
  clear all.
- **5 preset workloads** (see below) via the presets modal.
- **Import / export / share** (see below).
- **Sound effects** — Web Audio oscillator sweeps (`SoundSynthesizer`
  singleton `soundFx`): click (sine 800→400 Hz), step (triangle 1200→600),
  play (sine 440→880), pause (sine 660→330). Toggled from the header
  speaker button; default on.
- **Onboarding** — first-run 3-step tour persisted to
  `localStorage['toy-scheduler-onboarded']`.
- **Native `<dialog>` modals** — presets, shortcuts, and onboarding use the
  platform dialog element for built-in focus trapping, Escape handling, and
  backdrop.
- **Simulation error banner** — engine exceptions surface as a dismissible
  banner instead of failing silently.
- **Responsive** — tablet ≤960px, mobile ≤640px; honors
  `prefers-reduced-motion`.

---

## Keyboard shortcuts

Ignored when the event target is an `INPUT`/`TEXTAREA`/`SELECT`/`BUTTON`, or
when **Ctrl/Meta/Alt is held** (so browser shortcuts are never hijacked).

| Key | Action |
|-----|--------|
| **Space** | Toggle play/pause (restarts from 0 if at end) |
| **←** | Pause and step back 1 ms (min 0) |
| **→** | Pause and step forward 1 ms (max = end) |
| **R** | Pause and reset playback to t = 0 |
| **C** | Cycle view: visualizer → comparison → race → visualizer |
| **1–9** | Select algorithm (1 = FCFS … 9 = MLFQ) and return to visualizer |

---

## Preset workloads

Five educational scenarios in `src/data/presets.ts`. Selecting one also
applies its default algorithm (and quantum, where set).

| ID | Name | Description | Default alg | Quantum |
|----|------|-------------|-------------|---------|
| `standard` | Standard Staggered Workload | Staggered arrivals, mixed bursts — classic textbook case. | `fifo` | — |
| `convoy` | Convoy Effect Demonstration | A 24 ms CPU-bound process arrives first; short processes wait excessively under FCFS. | `fifo` | — |
| `preemption` | SRTF & Priority Preemption Showcase | Shorter/higher-priority tasks arrive mid-execution and preempt. | `srtf` | — |
| `round-robin` | Round Robin Quantum Slicing | All arrive at t=0 to highlight time slicing and context switches. | `roundRobin` | 2 |
| `priority-test` | Priority Scheduling Matrix | Multiple priority levels to compare preemptive vs non-preemptive priority. | `priorityPreemptive` | — |

App default state (no URL state): `standard` preset, `fifo`, quantum 2,
1 core.

---

## Import / export / share

**Export** — `workload.json` (pretty-printed process array) or
`workload.csv` (header `pid,arrivalTime,burstTime,priority`).

**Import** — `.json` (array or `{processes:[…]}`) or `.csv` (optional
header row detected via "pid"/"process"; columns `pid,arrival,burst[,priority]`;
PID uppercased, colors auto-assigned). Per-row validation errors and
duplicate-PID warnings appear in a confirmation dialog; **Confirm is
disabled while validation errors exist**.

**Shareable permalinks** — `encodeStateToURL` compresses the full state
`{v, p:[{pid,arr,burst,pri,color}], alg, q, cores}` into a base64 `?s=` URL
param. Guards:

- `SCHEMA_VERSION = 1` — decode rejects other versions.
- `MAX_PROCESSES = 20` — decode slices input to 20 processes.
- Algorithm must be one of the 9 valid IDs (derived from `ALGORITHMS`, the
  single source of truth); otherwise falls back to `fifo`.
- Quantum falls back to `2`, core count to `1` (must be an integer 1–4).
- Every decoded process is re-validated (`validateProcessInput`); any
  failure rejects the whole decode.
- Encode returns `null` if the final URL exceeds **2000 chars** (browser
  practical limit); the Share button then shows "Too long" for 3 s,
  otherwise copies to clipboard and shows "Copied!" for 2 s.

---

## Project structure

```
Toy Scheduler/
├── index.html                 # Vite entry; Google Fonts (Inter + JetBrains Mono)
├── package.json               # scripts + deps (only react, react-dom at runtime)
├── vite.config.ts             # react plugin, dev port 5173
├── vitest.config.ts           # globals: true, environment: "node"
├── tsconfig.json              # ES2020, strict, jsx: react-jsx, noEmit
├── eslint.config.mjs          # flat config: js + typescript-eslint + react-hooks
├── README.md, FOLLOWUP.md     # docs
├── public/                    # icons and favicons
└── src/
    ├── main.tsx               # ReactDOM root + StrictMode
    ├── App.tsx                # root state: processes, algorithm, quantum,
    │                          #   coreCount, viewMode, playback, sound, modals,
    │                          #   keyboard shortcuts, simError, share state
    ├── types.ts               # Process, TimelineSlice, ProcessResult,
    │                          #   SimulationResult, AlgorithmType (9 ids),
    │                          #   option interfaces, AlgorithmInfo, PresetWorkload
    ├── index.css              # full design system (single stylesheet)
    ├── engine/
    │   ├── scheduler.ts       # 9 algorithms + validation + metrics +
    │   │                      #   runAlgorithm + runMultiCore
    │   └── __tests__/scheduler.test.ts      # 68 engine tests
    ├── components/
    │   ├── Header.tsx         # top bar; exports ALGORITHMS metadata + COLORS
    │   ├── ProcessControlCenter.tsx  # sidebar: workload list, import/export, add form
    │   ├── ReadyQueueHud.tsx  # ready + completed chips at current t
    │   ├── CpuMonitorHud.tsx  # running-process ring + progress bar
    │   ├── PlaybackControls.tsx      # transport bar + speed select
    │   ├── GanttChart.tsx     # per-core Gantt timeline
    │   ├── ExplanationBar.tsx # "Why?" decision message
    │   ├── ProcessResultsTable.tsx   # per-process metrics table
    │   ├── AlgorithmLeaderboard.tsx  # compare mode (all 9 ranked)
    │   ├── RaceMode.tsx       # race mode (all 9 mini-Gantts)
    │   ├── PresetsModal.tsx   # native <dialog> preset picker
    │   ├── KeyboardShortcutsModal.tsx
    │   └── OnboardingModal.tsx
    ├── data/
    │   └── presets.ts         # 5 preset workloads
    └── utils/
        ├── audio.ts           # SoundSynthesizer singleton (soundFx)
        ├── chartUtils.ts      # niceStep(), buildColorMap(), downloadFile()
        ├── decisionLog.ts     # generateDecisionLog() → per-slice "why?" messages
        ├── shareUrl.ts        # permalink encode/decode/clear
        └── __tests__/shareUrl.test.ts    # 18 permalink tests
```

---

## Architecture notes

**Data flow:** `App.tsx` owns state → memoized
`runAlgorithm(algorithm, processes, {quantum})` → `runMultiCore(result,
coreCount)` → consumed by HUDs, Gantt, table, and ExplanationBar. The
leaderboard and race modes each re-run all 9 algorithms themselves (memoized
on `[processes, quantum]`). Engine exceptions are caught into an empty
result for rendering, while a separate effect sets a `simError` banner.

**Single source of truth:** `ALGORITHMS` in `Header.tsx` drives the header
selector, keyboard keys 1–9, the share-URL algorithm whitelist
(`VALID_ALGORITHMS` is derived from it), and the leaderboard/race ordering.
`COLORS` (8 colors) is exported from `Header.tsx` and shared by the random
generator, process form, and presets.

**Anti-fragmentation:** Round Robin and SRTF avoid pointlessly slicing a
process that is alone in the queue — it runs continuously up to the next
arrival or completion. Regression-tested (see Validation tests below).

**Refactoring history:** `FOLLOWUP.md` logs the verification pass and the
Ponytail-guided refactor (native `<dialog>` modals, parameterized audio
helper, shared `chartUtils`, dead CSS removal, etc.).

---

## Validation rules

`validateProcessInput(p)` (exported from the engine) is the shared
validator used by the engine, the import flow, and the share-URL decoder:

1. PID required and non-empty after trim.
2. `arrivalTime` must be a finite **integer** and `>= 0`.
3. `burstTime` must be a finite **integer** and `> 0`.

`validateProcesses` (internal) additionally throws on **duplicate PIDs**
(`Duplicate process ID found: <pid>`) before delegating per-process checks.
Round Robin additionally requires a positive integer quantum.

Errors surface in the UI as field-level form errors (add-process form),
per-row import errors (confirmation dialog), or the dismissible simulation
error banner.

---

## Testing

**Runner:** Vitest with `globals: true` and `environment: "node"` (no jsdom
— `shareUrl` tests mock `window`/`location`/`history` on `globalThis`).
`tsconfig` includes `"types": ["vitest/globals"]`.

**86 tests** across two co-located suites:

| Suite | Tests | Coverage themes |
|-------|------:|-----------------|
| `src/engine/__tests__/scheduler.test.ts` | 68 | Exact timeline equality, metric formulas, determinism, PID tie-breaks, starvation/aging, RR anti-fragmentation regressions, duplicate-PID ×5 and invalid-value ×4 validation, quantum validation, Priority+Aging, MLQ, MLFQ, multi-core core-assignment and no-overlap. |
| `src/utils/__tests__/shareUrl.test.ts` | 18 | Encode (s param, schema version, round-trip, 2000-char limit), decode (missing/malformed/non-JSON/wrong shape, schema version, fallbacks for alg/quantum/cores, 20-process cap, negative-arrival/zero-burst rejection, NaN handling, full valid payload). |

```bash
npx vitest run        # headless
npm run test:ui       # vitest UI
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

- **TypeScript** — ES2020 target, `strict: true`, `moduleResolution:
  bundler`, `jsx: react-jsx`, `noEmit`, `isolatedModules`, `skipLibCheck`.
- **ESLint** — flat config; JS recommended + `typescript-eslint` recommended
  + `react-hooks` recommended for `**/*.{ts,tsx}`; ignores `dist`.
- **Vite** — `@vitejs/plugin-react`, dev port 5173.
- **Bundle** — ~257.5 KB JS (77.8 KB gzip), ~21.9 KB CSS (4.6 KB gzip).

---

## Design system

`src/index.css` is a single precision **light theme** stylesheet organized
into comment-delimited sections (design tokens → app shell → workspace →
forms → metrics → transport → Gantt → tables → leaderboard → modals →
responsive → reduced-motion).

Tokens live on `:root`:

- **Fonts** — `--font-sans` (Inter + system), `--font-mono` (JetBrains Mono).
- **Surfaces** — `--bg #f5f6f8`, `--surface #fff`, `--surface-2/3`,
  `--overlay`.
- **Borders** — `--border`, `--border-strong`, `--border-focus`.
- **Text** — `--text-1/2/3` three-step hierarchy.
- **Accent/status** — `--accent #2154f0`, `--green #0f9168`,
  `--red #d3382f`, `--amber #a05e03` (+`-soft` variants).
- **Radii/shadows/easing** — `--radius-sm/md/lg/full`, `--shadow-sm/md/lg`,
  `--ease: cubic-bezier(0.2,0,0,1)`.

Responsive breakpoints: tablet ≤960px, mobile ≤640px. Includes custom
scrollbars, `fade-in`/`rise-in` keyframes, a focus-visible ring, and
`@media (prefers-reduced-motion: reduce)`.

---

## Contributing notes

- Prefer **native platform features** and existing helpers over new
  abstractions (see `chartUtils.ts`, `ALGORITHMS`, `COLORS`).
- New algorithms must: join the `AlgorithmType` union, get a `runAlgorithm`
  case, appear in `ALGORITHMS` (which automatically updates keys, share
  whitelist, and both comparison modes), and ship with engine tests
  (exact timeline + metrics + edge cases).
- New state that should survive sharing must be added to the share-URL
  schema — bump `SCHEMA_VERSION` if the format changes incompatibly.
- Keep validation in `validateProcessInput` as the single source of truth.
- Run `npx vitest run && npx tsc --noEmit && npm run build` before
  committing.
