# Quantum Scheduler

An interactive CPU scheduling algorithm visualizer supporting FIFO (FCFS), SJF, SRTF, Round Robin, and Priority preemptive/non-preemptive algorithms. Build workloads, step through execution, and compare algorithms side by side.

## Setup

```bash
npm install
npm run dev
npm test
npm run build
```

## Features

- Animated Gantt timeline with playback controls (play, pause, step, speed)
- Preset workloads and random workload generation
- Algorithm comparison leaderboard (run all algorithms on the same workload)
- Keyboard shortcuts (Space, Arrow keys, 1–6 for algorithms, R, C)
- Sound effects with mute toggle
- Responsive layout for mobile, tablet, and desktop
- Keyboard-navigable Gantt blocks with focus-visible states

## Tech Stack

Vite · React 19 · TypeScript · Vitest
