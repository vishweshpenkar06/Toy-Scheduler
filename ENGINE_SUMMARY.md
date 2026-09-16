# Toy Scheduler - Core Engine Summary

> **Last updated**: Verification & Hardening Pass (after 8-section upgrade)

## Project Setup
- **Framework**: Vite + React 19 + TypeScript
- **Testing**: Vitest (85 tests, node environment)
- **Package manager**: npm
- **Styling**: Plain CSS (src/index.css)
- **Structure**:
  - `/src/types.ts` - Core TypeScript interfaces
  - `/src/engine/scheduler.ts` - All 9 scheduling algorithms + multi-core
  - `/src/engine/__tests__/scheduler.test.ts` - 68 engine tests
  - `/src/utils/shareUrl.ts` - Permalink encode/decode
  - `/src/utils/__tests__/shareUrl.test.ts` - 17 permalink tests
  - `/src/components/` - 14 UI components

## Scheduling Algorithms (9 total)

| # | Algorithm | ID | Preemptive | Notes |
|---|-----------|----|------------|-------|
| 1 | FCFS | `fifo` | No | First-Come First-Served |
| 2 | SJF | `sjf` | No | Shortest Job First |
| 3 | SRTF | `srtf` | Yes | Shortest Remaining Time First |
| 4 | Round Robin | `roundRobin` | Yes | Configurable quantum |
| 5 | Priority (NP) | `priorityNonPreemptive` | No | Lower number = higher priority |
| 6 | Priority (P) | `priorityPreemptive` | Yes | Preemptive priority |
| 7 | Priority + Aging | `priorityAging` | Yes | Prevents starvation via aging |
| 8 | Multilevel Queue | `multiLevelQueue` | No | Fixed priority bands, FIFO per level |
| 9 | MLFQ | `multiLevelFeedback` | Yes | Feedback queue with demotion + aging |

## Multi-Core Simulation
- Supports 1-4 cores via global ready queue model
- Single-core results are byte-identical to the original single-core output
- Metrics preserved from single-core computation
- Per-core idle gap detection in Gantt chart

## Test Coverage (85 tests)

- **Engine tests**: 68 (scheduler.test.ts)
- **Permalink tests**: 17 (shareUrl.test.ts)
- **Component tests**: 0 (gap)

## Key Features
- Deterministic scheduling (same input → same output)
- Discrete-time simulation
- Comprehensive metrics (waiting, turnaround, response, completion)
- Shareable permalinks (base64-encoded URL state)
- CSV/JSON import/export for workloads
- Race mode (all 9 algorithms animated simultaneously)
- Step-by-step "why" explanations
- 3-step onboarding modal
- Responsive layout (960px, 640px breakpoints)
- Keyboard shortcuts (Space, arrows, R, C, 1-9)

## Running Tests

```bash
npx vitest run           # Run all tests
npm run build            # TypeScript check + production build
```
