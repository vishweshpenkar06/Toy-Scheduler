# Improvement Plan — Toy Scheduler / Quantum Scheduler

Produced by a full read of the engine, the React surface, the tooling, and
`npm outdated`, cross-checked against the 232-test suite. Every item below is
tied to a concrete `file:line`.

**Evidence levels**

| Tag | Meaning |
| --- | --- |
| **[V]** | Verified directly during this audit (read + traced, or reproduced) |
| **[A]** | Reported by a static audit pass and not yet reproduced at runtime. Reproduce first — write the failing test, then fix. |

**Verification gate** (all four must pass before any commit):

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

---

## 0. Executive summary — the ten that matter

| # | Sev | Area | Finding |
| --- | --- | --- | --- |
| 1 | **HIGH** | UI correctness **[V]** | Benchmark and Race views silently ignore `coreCount` — set Cores=4, both still report single-core numbers |
| 2 | **HIGH** | UI correctness **[V]** | CPU utilisation shown in the header double-subtracts context switches and counts I/O as busy |
| 3 | **HIGH** | UI correctness **[A]** | Submitting a process with Enter validates against stale state — invalid `arrival = -5` is accepted |
| 4 | **HIGH** | Engine **[A]** | `readySince` is never reset, so `adaptive` measures "since first arrival", not "since continuously ready" |
| 5 | **HIGH** | Engine **[A]** | Priority-aging is `O(d·n²·cores)`; 200 processes ≈ 1.3×10⁸ ops on the main thread |
| 6 | **HIGH** | UI perf **[V]** | `RaceMode` re-runs 17 full simulations on **every animation frame** |
| 7 | **HIGH** | UI perf **[V]** | Zero `React.memo` anywhere; every playback tick re-renders the whole app |
| 8 | **HIGH** | A11y **[V]** | Four clickable `<div>`/`<span>` elements are unreachable by keyboard |
| 9 | **HIGH** | A11y **[V]** | `CommandPalette` has no focus trap, no `aria-modal`, no focus restore, invalid listbox semantics |
| 10 | **HIGH** | Supply chain **[V]** | Vite 4 majors, Vitest 3 majors, TypeScript 2 majors behind. No CI at all (`.github/` does not exist) |

---

## 1. P0 — correctness defects (fix before any feature work)

### P0-1 · `coreCount` silently dropped in two of six views **[V]**

`App.tsx:425-433` (`AlgorithmLeaderboard`) and `App.tsx:446-455` (`RaceMode`)
are not passed `coreCount`. Both call `runAlgorithm(alg, processes, { quantum,
contextSwitchCost })`, which defaults to `coreCount = 1` (`runAlgorithm.ts:95`).
`ExperimentLab` *is* passed it (`App.tsx:439`), which proves the omission is an
oversight rather than a design decision. `RaceMode.tsx:214` compounds it with a
hardcoded `* 1`.

**Why it matters:** the two views whose entire purpose is *comparing* algorithms
produce single-core numbers while the header says 4 cores. A user comparing
FCFS against Round Robin on 4 cores is reading fiction.

**Fix:** thread `coreCount` into both components and into their `runAlgorithm`
options; delete the `* 1`.
**Verify:** add a test asserting `RaceMode`/`AlgorithmLeaderboard` produce a
different ranking at `coreCount: 1` vs `coreCount: 4`.
**Effort:** S.

---

### P0-2 · Header CPU utilisation is computed wrong **[V]**

```ts
// App.tsx:331-334
const idleSpan = timeline.filter((s) => s.pid === 'idle').reduce(…);
const csSpan   = timeline.filter((s) => s.kind === 'CONTEXT_SWITCH').reduce(…);
const busySpan = totalSpan - idleSpan - csSpan;
```

Two independent errors:

1. **Double subtraction.** Context-switch slices carry `pid: "idle"`
   (`SimulationKernel.ts:157`), so `csSpan ⊆ idleSpan` — it is removed twice.
2. **I/O counted as busy.** I/O slices carry the *process* pid and no `core`
   (`SimulationKernel.ts:232`), so they are absent from `idleSpan` and land in
   `busySpan` as if they were CPU time.

The engine already computes this correctly (`metrics.ts:23-27`). The UI
reimplements it, differently, wrong. With `quantum: 1` and
`contextSwitchCost > 0` the result can go **negative**.

**Fix:** delete `App.tsx:328-334`; render `metrics.cpuUtilization`.
**Verify:** assert the header value equals `metrics.cpuUtilization` for a
workload with I/O and CS cost.
**Effort:** XS.

---

### P0-3 · Enter-to-submit validates stale state **[A]**

`ProcessControlCenter.tsx:171-174`: `handleSubmit` calls `handleFieldBlur()`
(which *queues* `setArrivalError` / `setBurstError`) and then guards on
`pidError || arrivalError || burstError` — still the previous render's values in
the same tick. Submitting with **Enter** (which fires no blur) with
`arrival = -5` adds an invalid process. Only the PID branch (`:176-180`)
re-checks synchronously.

**Fix:** extract a pure `validate(pid, arrival, burst, processes)` → errors and
call it from both `handleFieldBlur` and `handleSubmit`.
**Verify:** regression test submitting a negative arrival without an explicit blur.
**Effort:** S.

---

### P0-4 · `readySince` never resets — adaptive anti-starvation is inverted **[A]**

`SimulationKernel.ts:114` uses `rt.readySince ??= this.time`, so `readySince` is
stamped once at arrival (`:351`) and never touched again across preemption
(`:202`) or I/O completion (`:410`).

`adaptivePolicy` reads it as "how long has this been continuously ready":
- `policies.ts:453` — `-(time - readySince)` is the *selection* key
- `policies.ts:435` — `waited = time - readySince` decides quantum widening

After a process's first dispatch its `readySince` still points at arrival, so on
re-dispatch it is the **longest-waiting** candidate by construction and receives
the widest quantum. Adaptive RR degenerates into "earliest `arrivalTime` wins" —
the opposite of the anti-starvation rule it exists to provide.

This is also the same class of bug as Phase 35's: a domain field overloaded as
algorithm state.

**Fix:** `rt.readySince = this.time` unconditionally in `pushReady`; give
policies their own bookkeeping if they need "since first arrival".
**Verify:** adaptive RR on equal workloads must not favour the earliest arrival.
**Effort:** S. **Risk:** medium — changes adaptive and HRRN behaviour; re-run
parity and the fairness suite.

---

### P0-5 · Blocking on I/O is charged a full context switch **[A]**

`stopRunning(..., "BLOCKED")` (`:198`) calls `hasPendingWork()`, which returns
true purely because the process just registered itself in `this.blocked` (`:229`,
checked `:145`). `startContextSwitch` then sets `core.freeAt = time + cost` (`:158`),
so `dispatchOn` bails at `:263` until `CONTEXT_SWITCH_COMPLETE` fires — even when
nothing else was ever queued for that core.

Traced prediction: 1 core, `IO1 = [cpu 3, io 4, cpu 3]`, cs=5 → I/O completes at
t=7, dispatch at **t=8**, with no competing process. Each block also inflates
`metrics.contextSwitchCount`.

**Fix:** make the pending-work test core-local — a process in `blocked` is not
work *for this core* — and emit the switch lazily in `dispatchOn` when a
*different* pid is actually loaded.
**Verify:** failing test asserting I/O unblocks at exactly `io end` when the
core is otherwise idle; assert CS count drops by one per sole I/O block.
**Effort:** M. **Risk:** medium — changes every CS metric and the phase-35
counting invariant. Reproduce the trace first.

---

### P0-6 · Idle time is attributed to core 0 and `totalIdleTime` is never written **[A]**

`emitIdle` hardcodes `core: 0` (`SimulationKernel.ts:141`) and fires only when
the *whole machine* is quiescent (`:477`). On a 4-core run, idle time on cores
1–3 is represented by no slice at all. `CoreRuntime.totalIdleTime` is
initialised (`:546`) and **never written**; `totalBusyTime` is written and never
read. Per-core utilisation therefore cannot be reconstructed from the timeline —
`GanttChart.tsx:50-64` silently recomputes idle gaps to compensate, which is
why the defect is invisible in the UI.

**Fix:** emit one `IDLE` slice per genuinely idle core; set `totalIdleTime`
there; drop the `core: 0` hardcode.
**Verify:** `sum(idle slices) == cores × span − sum(busy)` per core.
**Effort:** M.

---

### P0-7 · Default `victimScore = remainingCpu` is wrong for three policies **[A]**

`SimulationKernel.ts:239-250`: only `srtf` and `lrtf` define `victimScore`. For
`priorityPreemptive`, `edf` and `rms` the victim is chosen by **longest
remaining CPU** — so a higher-priority / earlier-deadline / shorter-period
arrival evicts whichever running job has the *most* work left. On 2–4 cores with
heterogeneous bursts this visibly starves long low-priority jobs.

**Fix:** give each policy a `victimScore` reflecting what it considers
least-deserving: priority → `-priority`, EDF → `-deadline`, RMS → `-period`.
**Effort:** XS. **Verify:** fairness suite + invariants must stay green.

---

### P0-8 · Pathological policies silently truncate instead of failing **[A]**

`runEventLoop` bails when time fails to advance 8× (`:507`); `run()` then marks
every still-running process `COMPLETED` (`:568-570`) and `computeProcessResults`
maps a missing `completionTime` to `0` (`:514`), producing
`turnaround = 0 − arrival` and **negative** average waiting time with no error.
`correctness.test.ts:174-189` exercises exactly this policy and only asserts
`not.toThrow()`.

**Fix:** if any runtime is not `TERMINATED` after the loop, throw
`Error("scheduler failed to converge")`. Flip the test to `toThrow`.
**Effort:** XS. Silent wrong answers are worse than loud failures.

---

## 2. Engine performance and invariants

### P1-1 · Priority-aging is `O(d·n²·cores)` **[A]**

`policies.ts:134-145` loops *every* ready process per dispatch and schedules a
private `AGING_TICK` for each. Each tick re-selects on *every* busy core
(`SimulationKernel.ts:442-448`), and each `selectNext` call copies `[...ready, rt]`
(O(n)) then `ageAt` (O(n)) then `pickBest` (O(n)).

For n=200, 16 cores, burst 100: ~40 000 queued events × ~3 200 ops ≈ **1.3×10⁸
operations**, no yield. The `nextTick` dedupe keys on an exact timestamp that
shifts every dispatch, so it never dedupes and the map is never pruned.

**Fix:** schedule **one** `AGING_TICK` per dispatch at the single earliest `due`
across `context.ready`; clear `nextTick` entries in `onProcessReady`.
**Verify:** a perf test asserting event count stays `O(d)` not `O(d·n)` for
n=200.
**Effort:** M.

### P1-2 · `Math.max(...timeline.map(...))` throws past ~100k slices **[A]**

Spread-into-`Math.max` is duplicated at `App.tsx:95`, `App.tsx:330`,
`GanttChart.tsx:27`, `CpuMonitorHud.tsx:17` — all of which are on the hot path.
Reachable at 200 processes with `quantum: 1`.

**Fix:** `reduce`. One-liners; do them together.
**Effort:** XS.

### P1-3 · Per-tick `O(processes × slices)` work **[A]**

`StateBoard.tsx:20-41` runs four `timeline.filter` passes *per process*.
`ReadyQueueHud.tsx:10-36` rebuilds a completion map and re-partitions all
processes every render. Both run ~9×/s during playback.

**Fix:** one shared `useMemo` on `[timeline]` producing `Map<pid, slices[]>` and
`Map<pid, completionTime>`, passed to both.
**Effort:** S.

### P1-4 · Leaderboard and ExperimentLab block the main thread **[V]**

`AlgorithmLeaderboard.tsx:32-43` runs 17 full simulations inside one `useMemo`;
`ExperimentLab.tsx:19` runs 8. On a 200-process workload with CS cost these
block for seconds with no progress indicator.

**Fix (Phase 41, below):** move simulation to a Web Worker with a progress
stream. This is the only fix that scales; the others just reduce constant factors.
**Effort:** L.

### P1-5 · Kernel never resets state between runs **[A]**

`SimulationKernel.run()` (`:533-555`) mutates 11 instance fields and clears none.
`runtimes` is re-`set` but `eventQueue`, `timeline`, `events`, `time`,
`eventSeq`, `dispatchSeq` and `rngState` all persist. `runAlgorithm` happens to
allocate a fresh kernel per call, so this is latent — but `KernelOptions.seed`
implies reusability, and nothing says "single-use".

**Fix:** reset all fields at the top of `run()` (`rngState = seed >>> 0 || 1`), or
make the class single-use and say so.
**Effort:** XS.

### P1-6 · `hrrn` computes "already served" wrongly for multi-burst **[A]**

`policies.ts:255-259`: `service - remainingCpu` is time still *owed*, not served.
For `[cpu 3, io 4, cpu 3]` after the first burst it credits 3 ms of service while
3 ms of I/O was consumed. HRRN has **no parity test**, so nothing catches it.

**Fix:** use the kernel's already-tracked `totalCpuExecuted` (`:130`), or track
`totalIoTime` in `beginIo` and subtract it.
**Effort:** S.

### P1-7 · `waitingTime` charges I/O and context switches **[A]**

`SimulationKernel.ts:516`: `waiting = turnaround − totalCpuTime(spec)`. Every I/O
duration and every `contextSwitchCost` the machine paid is billed as waiting, so
turning CS cost up inflates waiting time for processes that never lost a core.
`ProcessRuntime.waitingTime` (`models.ts:42`) is initialised to 0 and **never
written** — a dead duplicate of the derived value.

**Fix:** accumulate waiting in `advanceRunning`/`pushReady` (wall-clock in READY
only); delete the dead field.
**Effort:** M. Changes reported metrics — needs a migration note in the report
template.

---

## 3. Dependency and tooling upgrades

`npm outdated` (registry as of today). **None of these are urgent for
correctness**; they are maintenance debt and one supply-chain exposure.

### Stage A — patch/minor, near-zero risk (do now)

| Package | Current | Target | Note |
| --- | --- | --- | --- |
| `react`, `react-dom` | 19.2.8 | 19.3.0 | minor |
| `@types/react`, `@types/react-dom` | 19.2.x | 19.3.0 | minor |
| `@testing-library/react` | 16.3.2 | 16.3.3 | patch |
| `typescript-eslint` | 8.67.0 | 8.71.1 | minor |

### Stage B — toolchain majors (one PR, isolated)

| Package | Current | Latest | Risk / benefit |
| --- | --- | --- | --- |
| `eslint` + `@eslint/js` | 9.39.5 | 10.12.0 | Low. Flat config already in use. |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.1.1 | Low–medium. New flat-config presets; may surface *new* lint errors (valuable — see U-2). |
| `globals` | 15.15.0 | 17.13.0 | Low. |

### Stage C — build & test majors (two PRs, one at a time)

| Package | Current | Latest | Risk / benefit |
| --- | --- | --- | --- |
| `vite` | **4.5.14** | **8.3.3** | **4 majors.** Modern browser target, faster HMR, `build.rollupOptions` available for chunking. Must upgrade `@vitejs/plugin-react` 4 → 6 in the same PR. |
| `vitest` | **1.6.1** | **4.1.11** | **3 majors.** Needed for `@vitest/coverage-v8` on a current Node; v1 is effectively EOL. `@vitest/ui` 1 → 5 alongside. |
| `typescript` | **5.7.3** | **7.0.2** | **2 majors.** Biggest unknown — expect new type errors. Do it *after* the test suite is at its most trustworthy, i.e. after §1 lands. |

**Order matters:** land §1 correctness work and CI *first*, then Stage C. Upgrading
TypeScript on top of an unverified engine is how you end up reinterpreting 200
type errors as "noise".

### U-1 · No CI at all **[V]**

`.github/` does not exist. Nothing runs the gate except a human.

**Add `.github/workflows/ci.yml`:** Node 22 + 25 matrix, `npm ci`, then
`vitest run` → `tsc --noEmit` → `eslint .` → `npm run build`. Add coverage via
`@vitest/coverage-v8` once Vitest is current. This is the single highest-leverage
item in the plan — it is what makes every other change safe.

### U-2 · `@testing-library/react` installed but unusable **[V]**

`vitest.config.ts` sets `environment: "node"`. No component can be tested. The
only component-adjacent test (`learning.test.ts`) exercises pure functions from
`learningContent.ts`. So **19 components have zero test coverage**, including
the a11y fixes in §5.

**Fix:** switch to `environment: "jsdom"` (or per-file `// @vitest-environment
jsdom`), add `jsdom` + `@testing-library/user-event`, then write tests for the
components touched in §5.

### U-3 · Strictness is lighter than it looks **[V]**

`tsconfig.json` sets `strict: true` but omits `noUncheckedIndexedAccess`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
`exactOptionalPropertyTypes`. Turning these on will surface real dead code
(the audit found ~20 unread domain fields) — treat it as a cleanup tool, and do
it in its own PR.

### U-4 · `package.json` metadata **[V]**

No `description`, `license`, `repository`, `engines`, or `keywords`. On a public
repo this costs nothing to fix and helps discoverability. Add a `typecheck`
script (`tsc --noEmit`) and a `verify` script that chains the full gate, so the
gate is one command locally and in CI.

---

## 4. UI performance

### P2-1 · `RaceMode` re-runs 17 simulations every frame **[V]**

`RaceMode.tsx:32-45`: the `useMemo` depends on `currentTimeStep`, but the body
only uses it for `isFinished` (`:42`) while doing the expensive part
(`ALGORITHMS.map(… runAlgorithm …))` at `:34-35`. At 4× speed the interval is
~112 ms, so ~150 kernel runs/second.

**Fix:** split into `useMemo(entries, [processes, quantum, contextSwitchCost])`
and `useMemo(isFinished, [entries, currentTimeStep])`. XS fix, very large win.

### P2-2 · Zero `React.memo`; unstable handler identities **[V]**

`React.memo` / `lazy(` appear nowhere in `src`. The six handlers at
`App.tsx:199-218` are plain arrows and the inline props at `:356-421` are fresh
objects each render, so memoising children alone would not help. Toggling
`soundEnabled`, `shareCopied` or `isPaletteOpen` re-renders `Header` (17
buttons), the whole `ProcessControlCenter`, `GanttChart` (every slice) and both
tables.

**Fix (in order):** `useCallback` the handlers → hoist the inline stat array
(`App.tsx:328-351`) into a `useMemo` → `memo()` `Header`,
`ProcessControlCenter`, `GanttChart`, `ProcessResultsTable`, `ReadyQueueHud`.
**Effort:** M. Measure before/after; this is the fix most likely to regress
subtly, so do it after CI exists.

### P2-3 · Synchronous `localStorage` write per keystroke **[V]**

`App.tsx:88-91` writes on every state change, and `Header.tsx:141`/`:171` fire
`onChange` per character → a full `JSON.stringify` + sync write per keystroke.

**Fix:** debounce ~300 ms, or write on `blur`.
**Effort:** XS.

### P2-4 · Playback-reset effect misses two inputs **[V]**

`App.tsx:99-102` deps are `[processes, algorithm, quantum]` while the simulation
memo at `:84` also depends on `coreCount` and `contextSwitchCost`. Changing Cores
mid-playback leaves `currentTimeStep` above the new max, so
`PlaybackControls.tsx:116` renders e.g. `340 / 12 ms` and the Gantt playline
vanishes.

**Fix:** share one dep array between the two.
**Effort:** XS.

### P2-5 · `App.tsx` and `ProcessControlCenter.tsx` are 467 lines each **[V]**

`App.tsx` holds 13 `useState` hooks, a simulation memo, 5 effects, a 100-line
global keymap, share/clipboard logic, business math in JSX and 6 view branches.
`ProcessControlCenter` mixes icons, CSV/JSON parsers, import validation, 11 state
hooks, a file upload, a random generator and a form.

**Fix:** extract a `useSimulation` hook, a `useKeyboardShortcuts` hook, and split
the control centre into `ProcessForm` + `WorkloadList` + `WorkloadImport`.
**Effort:** L. Do it *after* the a11y fixes so behaviour is pinned by tests.

### P2-6 · `clipboard.writeText` has no `.catch()` **[V]**

`App.tsx:229-232` — rejects on permission denial or a non-secure context,
producing an unhandled rejection and leaving the button stuck on "Copied!".

**Fix:** `.catch(() => setShareCopied(false))`.
**Effort:** XS.

---

## 5. Accessibility (WCAG 2.1 AA)

### A-1 · Four clickable non-interactive elements **[V]**

`RaceMode.tsx:89-91`, `AlgorithmLeaderboard.tsx:74`, `PresetsModal.tsx:33-37`,
and `ProcessControlCenter.tsx:449-455` (a colour swatch `<span onClick>` with no
accessible name at all — only a `title` hex string). None has `role`,
`tabIndex`, or `onKeyDown`. Keyboard and screen-reader users cannot operate them
(WCAG 2.1.1, 4.1.2).

**Fix:** real `<button>` for the three divs; the swatch becomes a radio group
(`role="radiogroup"` + `role="radio" aria-checked`) or 8 visually-labelled
radios.
**Effort:** S.

### A-2 · `CommandPalette` dialog is not a dialog **[V]**

`CommandPalette.tsx:74-130`: `role="dialog"` with **no `aria-modal`**, the page
behind never `inert`, focus is moved in on open (`:58`) and **never restored** on
close, `role="listbox"` (`:107`) contains `<button role="option">` (`:112-119`)
which is invalid, and because DOM focus stays in the input there is no
`aria-activedescendant` — so screen readers never announce the highlighted
option. Arrow/Escape handling only works while the input has focus, and
`App.tsx:139` bails on `BUTTON`, so tabbing to an item kills all keys.

**Fix:** add `aria-modal`, `inert` the app root while open, restore
`document.activeElement` on close, move `role="option"` to `<li>` with
`aria-activedescendant` on the input, handle Escape/Tab at dialog level.

### A-3 · Global shortcuts die after any click **[V]**

`App.tsx:139` bails when the active element is `INPUT|TEXTAREA|SELECT|BUTTON`.
Focus stays on the last clicked button, so after clicking an algorithm chip,
`Space`/`←`/`→`/`R`/`C`/`L`/`I` silently do nothing — contradicting the modal
(`KeyboardShortcutsModal.tsx:9-16`).

**Fix:** bail only for text entry; handle `BUTTON`+`Space` explicitly with
`preventDefault()`.
**Effort:** S.

### A-4 · `GanttChart` blocks are `role="button"` with no key handler **[V]**

`GanttChart.tsx:173-180`: blocks are focusable and labelled but `role="button"`
on a `<div>` does not map Enter/Space to `onClick`, so pinning is mouse-only.
Idle blocks keep `onClick` despite having no role.

**Fix:** add `onKeyDown` for Enter/Space; drop `onClick` from idle blocks.
**Effort:** XS.

### A-5 · Algorithm selection is colour-only **[V]**

`Header.tsx:114-127` + `index.css:204-208`: `.seg-btn.active` differs only by
background/colour/shadow. No `aria-pressed`, and the 17 buttons sit in a `<nav>`
with no accessible name.

**Fix:** `aria-pressed` on each chip, `<nav aria-label="Scheduling algorithm">`.
**Effort:** XS.

### A-6 · No `<h1>` anywhere **[V]**

Heading order starts at `<h2>` in every view; `Header.tsx:106` has the brand as a
plain element. WCAG 1.3.1 / 2.4.6.

**Fix:** brand becomes `<h1>`, or a visually-hidden `<h1>` per view.
**Effort:** XS.

### A-7 · `OnboardingModal.showModal()` throws under StrictMode **[V]**

`OnboardingModal.tsx:20-24`: `main.tsx:7` wraps in `React.StrictMode`, so effects
run mount→cleanup→mount on the same retained DOM node; the second
`showModal()` hits an already-open dialog → uncaught `InvalidStateError`. The
cleanup never calls `close()`. `PresetsModal.tsx:17` and
`KeyboardShortcutsModal.tsx:26` already use the correct guard.

**Fix:** `if (!ref.current?.open) ref.current?.showModal()`.
**Effort:** XS.

### A-8 · Tables lack `scope="col"` and captions **[A]**

`ProcessResultsTable.tsx:21-33`, `ExperimentLab.tsx:113-121`.

**Fix:** `scope="col"` on each `<th>`, plus a visually-hidden `<caption>`.
**Effort:** XS.

**Not to regress** (already good): `lang="en"`; a single `:focus-visible` ring;
`prefers-reduced-motion` honoured; real 960/640 breakpoints; tables and Gantt
scroll on narrow viewports; native `<dialog>` used for three modals; status never
encoded by colour alone (`StateBoard.tsx:71`, `ProcessResultsTable.tsx:53`,
`CpuMonitorHud.tsx:24`); all number inputs bounded; all `<select>`s labelled.

---

## 6. Dead code and structure

### D-1 · `engine/scheduler.ts` — 748 of 837 lines duplicated **[A]**

The eight legacy algorithms duplicate `policies.ts` + the kernel. Only
`validateProcessInput` (`scheduler.ts:13-30`) is production-live — imported by
`shareUrl.ts:3` and `ProcessControlCenter.tsx:4` — and it is a **weaker**
duplicate of `domain/validation.ts:16-56`: it checks only `burstTime`, ignoring
`bursts`, `priority`, `deadline`, `period`, `weight`, `tickets`. So the UI accepts
input the kernel rejects, surfacing as the `App.tsx:307` error banner instead of a
field-level message. `runAlgorithm.ts:22` also imports 8 legacy symbols purely to
re-export them, so **the entire 723-line dead file ships in the production
bundle**.

**Fix:** move `validateProcessInput` into `domain/validation.ts` as a
`Process` → message adapter over `validateProcessSpec`; delete `scheduler.ts`;
move the legacy algorithms into `parity.test.ts` where they are actually used.
**Effort:** M. **Risk:** medium — 68 tests in `scheduler.test.ts` import from it.
Do this *after* CI exists.

### D-2 · `utils/explain.ts` is a dead, stale clone of `utils/decisionLog.ts` **[A]**

`explain.ts:24-162` has **no importers**. `ExplanationBar.tsx:3` uses
`decisionLog.ts` instead. The two have already drifted: `decisionLog.ts:23-29`
handles `kind === 'IO'` and 8 more algorithms; `explain.ts` handles none and falls
through to `default`. Editing the dead copy changes nothing — a trap.

**Fix:** delete `explain.ts:24-162`; keep `RULES` (used by `learningContent.ts:3`)
and `buildExplanations` (used by `phases.test.ts:4`).
**Effort:** S.

### D-3 · `dataStructures.ts` is dead; `EventQueue` re-implements `MinHeap` **[A]**

`MinHeap`/`PriorityQueue`/`Deque` are referenced only by their own test.
`EventQueue.bubbleUp/bubbleDown` (`EventQueue.ts:57-78`) are line-for-line
`MinHeap.bubbleUp/bubbleDown` (`dataStructures.ts:33-54`) with a fixed
comparator. `clear()` exists on all three and is never called.

**Fix:** delete `dataStructures.ts` and its test; express `EventQueue` as
`MinHeap<SimulationEvent>` with an `EVENT_PRIORITY` comparator — one class, one
heap, one test. (Keeps the exercise value; loses the dead code.)
**Effort:** S.

### D-4 · Fiction in the domain model **[A]**

Never-read fields: `CoreRuntime.totalBusyTime`/`totalIdleTime`/`contextSwitches`,
`ProcessRuntime.totalCpuExecuted`/`remainingIo`/`totalIoTime`/`migrations`/
`preemptions`/`waitingTime`/`turnaroundTime`/`firstRunAt`. Never-read config:
`SystemConfig.dispatchLatency`, `migrationCost`. Never-used types:
`ProcessClass`/`ProcessSpec.class`/`affinity`, `StopReason "MIGRATED"`,
`SliceKind "INTERRUPT"`, `SimulationEventType "DEADLINE"|"LOAD_BALANCE"|
"MIGRATION"` (+ their `EVENT_PRIORITY` slots).

**Fix:** delete them. The compiler currently implies support that does not exist
— which is how a reader concludes RMS models periodic deadlines when it is really
static priority (`policies.ts:405-420`).

### D-5 · Dead branches in the kernel **[A]**

- `:133-135` — `if (rt.remainingCpu <= 0) rt.remainingCpu = 0;` is unreachable;
  `Math.min(dt, remainingCpu)` at `:128` already guarantees ≥ 0.
- `:192` — `rt.responseTime ??= …` is dead; always set at `:275`.
- `:400-401` — `interval.end = this.time` then immediately `blocked.delete(rt)`;
  the write is never read.
- `:452-459` — the whole `case "PREEMPT"` is dead: every `stopRunning(…,
  "PREEMPTED")` call site stops the process before its own event is dequeued, so
  `isStale` at `:453` always breaks.
- `metrics.ts:10` — `deadlines` never read, yet `SimulationKernel.ts:589` runs an
  extra `.filter()` to compute it.

### D-6 · Unused barrels and test-only exports **[A]**

`simulation/index.ts` and `domain/index.ts` have zero importers.
`shareUrl.ts:90 clearURLParams`, `experiment.ts:44 compareAlgorithms`,
`persistence.ts:39 clearSession`, `explain.ts:210 buildExplanations` are
production-dead (tests only). `src/data/presets.ts` is clean — all 9 presets are
reachable.

### D-7 · Singletons that would leak state **[A]**

`fcfsPolicy`, `sjfPolicy`, `srtfPolicy`, `hrrnPolicy`, `lrtfPolicy`,
`edfPolicy`, `rmsPolicy` are exported as **module-level singletons**. Adding any
state to one leaks silently across every run in the app. The closure-based
policies are safe because `createPolicy` builds a fresh instance per call. Neither
form is documented, and Phase 36 already had to convert stride/WFQ for exactly
this reason.

**Fix:** convert all policies to factories; document the rule.
**Effort:** S.

---

## 7. New capabilities

Grounded in what the audit shows is missing, roughly in value order.

### N-1 · Simulation in a Web Worker **[P1-4]** ★ highest value
Moves the 17-run leaderboard and 8-run experiment lab off the main thread with
progress streaming. Enables large workloads (200+ processes) that are currently
unusable in Benchmark/Race. Also the natural home for future Monte Carlo.

### N-2 · Seeded Monte Carlo across random workloads **[Phase 38]**
Run N generated workloads against a chosen algorithm and report the distribution
(waiting time p50/p95, fairness, deadline misses) instead of a single number.
`RunOptions.seed` and `utils/experiment.ts` already exist. Needs N-1 first.

### N-3 · Jain fairness index on CPU share **[Phase 38]**
`ExtendedMetrics.jainFairness` exists in the type but is computed over waiting
times, not shares. Recompute from per-process executed CPU, which is the
definition students are taught. The Phase-37 invariant harness already computes
exactly this quantity.

### N-4 · A/B diff view **[Phase 39]**
Side-by-side Gantt of two algorithms on the same workload with a per-slice delta
table ("where did these two disagree?"). This is the comparison tool the app
implies but does not have — `comparison` mode is a leaderboard, not a diff.

### N-5 · Report embeds the Gantt **[Phase 39]**
`utils/report.ts` emits Markdown/CSV but no visual. Rendering the Gantt into the
report (SVG or PNG) makes an exported report self-contained.

### N-6 · Saved sessions **[Phase 39]**
`localStorage` holds one session. Named, restorable sessions is a small increment.

### N-7 · True periodic-task modelling for EDF/RMS **[D-4]**
`deadline`/`period` exist in the model but are used as static priority
(`policies.ts:405-420`), and the corresponding event types are never emitted. This
is either implemented or removed — a model field that implies support it does not
have is worse than no field.

### N-8 · Keyboard shortcut registry as data **[A-3]**
One table driving both the handler and the modal, so they cannot drift again.
`KeyboardShortcutsModal.tsx` already lists them; the duplication is manual.

### N-9 · Per-core utilisation view **[P0-6]**
Blocked on P0-6: the timeline cannot currently express per-core idle time.

### N-10 · Export Gantt as PNG / JSON
Cheap once N-5 exists; reuses the same SVG.

**Deliberately not planned:** state-management library (Redux/Zustand) — the app's
state is 13 hooks, and a library would be a rewrite with no payoff;
Storybook — 19 components with no component tests is the real gap, fix U-2
first; i18n — single-locale project; a database — `localStorage` + share URLs
already cover offline-first, which is a project constraint.

---

## 8. Sequenced delivery

One branch + one PR per phase, as established. Each stacks on the previous.

| Phase | Scope | Gate to enter |
| --- | --- | --- |
| **35** ✅ | Nine engine defects | done, pushed |
| **37** ✅ | Invariant harness (306 runs) | done, pushed |
| **36** ✅ | Real Stride/WFQ | done, pushed |
| **38** | P0-1…P0-8 correctness, each with a failing-then regression test | — |
| **39** | CI (U-1) + test env (U-2) + Stage A/B upgrades | 38 green |
| **40** | A11y §5 + UI perf §4 | 39 green |
| **41** | Dead code §6 | 40 green |
| **42** | Stage C upgrades (Vite 8, Vitest 4, TS 7) | 41 green |
| **43** | New capability N-1 (Web Worker) | 42 green |
| **44+** | N-2…N-10 | — |

**Why CI lands at 39 and not before:** phases 38–41 are invasive; the gate is
currently a human. CI before them, not after.

**Why Stage C (Vite/Vitest/TS majors) is last:** each is a multi-major jump with
breaking changes. Doing them while the engine is still being restructured means
you cannot tell a type error from a regression. Order: correct engine → tests
trustworthy → then the toolchain.

**Per-phase rule (established in 35/36/37):** every fix ships with a regression
test that **fails on the pre-fix code**. Verified for Phase 35 (10/11 fail on old),
37 (6/18), 36 (4/8).

---

## 9. Open blockers

1. **`gh` is installed but not authenticated.** The Phase 35/37/36 branches are
   pushed; the PRs have to be opened once `gh auth login` is run. Bases stack:
   37 off 35, 36 off 37.
2. **§1 items marked [A] need reproduction first.** Each should open with a
   failing test. In particular P0-5 (I/O charging a context switch) is a traced
   prediction, not a measurement — confirm the t=7 vs t=8 delay before changing
   it, because it will move every CS metric and the Phase 35 counting invariant.