# Baseline — Quantum Scheduler 2.0 Phase 0

Recorded 2026-09-23 before any transformation work.

## Gate results

| Gate | Result |
|------|--------|
| `npx vitest run` | **86/86 pass** (68 engine + 18 shareUrl), ~0.4s |
| `npx tsc --noEmit` | **OK** |
| `npm run build` | **OK** — 2.6s; 257.50 KB JS (77.80 KB gzip), 21.90 KB CSS (4.57 KB gzip), 53 modules |
| `npx eslint .` | **FAIL — 7 errors, 1 warning** (documented below) |

## Lint failures at baseline

| File | Line | Rule | Issue |
|------|------|------|-------|
| `src/App.tsx` | 62 | `no-unused-vars` | unused `err` in catch |
| `src/App.tsx` | 341 | `no-empty` | empty catch block |
| `src/components/AlgorithmLeaderboard.tsx` | 33 | `react-hooks/rules-of-hooks` | `useMemo` called after early return |
| `src/components/RaceMode.tsx` | 25 | `no-unused-vars` | unused `setPinnedAlg` |
| `src/components/RaceMode.tsx` | 40 | `react-hooks/exhaustive-deps` | `currentTimeStep` missing from deps |
| `src/components/RaceMode.tsx` | 83 | `no-unused-vars` | unused `progress` |
| `src/utils/audio.ts` | 7 | `no-explicit-any` | `webkitAudioContext` cast |
| `src/utils/audio.ts` | 29 | `no-empty` | empty catch block |

**Reason lint is broken:** accumulated dead code and one real rules-of-hooks violation
(conditional early return before `useMemo` in `AlgorithmLeaderboard`). Fixed as part of
Phase 0 so the baseline gate is green before transformation work.

## Inventory

- 15 source files under `src/` (1 engine, 11 components, 1 data, 4 utils, types, App, main, CSS)
- Runtime deps: `react`, `react-dom` only
- Scripts: `dev`, `build` (tsc && vite build), `test` (vitest watch), `test:ui`, `lint`
- Tests: 2 suites — `src/engine/__tests__/scheduler.test.ts`, `src/utils/__tests__/shareUrl.test.ts`
- Config: `tsconfig.json` (ES2020, strict, noEmit), `vite.config.ts`, `vitest.config.ts` (node env, globals), `eslint.config.mjs` (flat)
- Docs: `README.md`, `FOLLOWUP.md`
