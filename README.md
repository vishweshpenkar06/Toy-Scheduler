# Quantum Scheduler

Interactive CPU scheduling algorithm visualizer. Build workloads, step through execution, and compare 9 algorithms side by side.

## Algorithms

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

## Features

- Animated Gantt timeline with playback controls (play, pause, step, speed)
- Multi-core simulation (1–4 cores, global ready queue)
- Algorithm comparison leaderboard and race mode (all 9 simultaneously)
- Step-by-step "why" explanations for each scheduling decision
- Preset workloads, random generation, CSV/JSON import/export
- Shareable permalinks (base64-encoded URL state)
- Keyboard shortcuts: Space (play), ←/→ (step), R (reset), 1–9 (algorithm), C (view)
- Sound effects with mute toggle
- Responsive layout (mobile, tablet, desktop)
- Native `<dialog>` modals with built-in focus trapping

## Setup

```bash
npm install
npm run dev       # Dev server
npm test          # Run all 86 tests
npm run build     # TypeScript + production build
```

## Tech Stack

Vite · React 19 · TypeScript · Vitest · Plain CSS
