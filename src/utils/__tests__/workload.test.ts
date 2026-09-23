import { describe, it, expect } from 'vitest';
import { generateWorkload } from '../workload';
import { sweepQuantum, compareAlgorithms } from '../experiment';
import { runAlgorithm } from '../../engine/runAlgorithm';

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('workload generator', () => {
  it('is deterministic with a seeded rng', () => {
    const a = generateWorkload('classic', 6, mulberry32(42));
    const b = generateWorkload('classic', 6, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('generates IO workloads that validate and run', () => {
    const procs = generateWorkload('io', 4, mulberry32(7));
    expect(procs.every((p) => p.bursts && p.bursts.length >= 3)).toBe(true);
    const r = runAlgorithm('roundRobin', procs, { quantum: 3 });
    expect(r.processResults).toHaveLength(4);
    expect(r.timeline.some((s) => s.kind === 'IO')).toBe(true);
  });

  it('generates deadline workloads', () => {
    const procs = generateWorkload('deadline', 5, mulberry32(1));
    expect(procs.every((p) => p.deadline != null && p.period != null)).toBe(true);
    const r = runAlgorithm('edf', procs);
    expect(r.metrics?.deadlineMisses).toBeGreaterThanOrEqual(0);
  });

  it('generates weighted workloads with tickets', () => {
    const procs = generateWorkload('weighted', 3, mulberry32(9));
    expect(procs.every((p) => (p.tickets ?? 0) >= 1)).toBe(true);
  });

  it('clamps count into [1,20]', () => {
    expect(generateWorkload('classic', 0).length).toBe(1);
    expect(generateWorkload('classic', 99).length).toBe(20);
  });
});

describe('experiment sweeps', () => {
  const workload = generateWorkload('classic', 5, mulberry32(3));

  it('sweepQuantum returns one point per quantum', () => {
    const sweep = sweepQuantum('roundRobin', workload, { quanta: [1, 2, 4] });
    expect(sweep.points).toHaveLength(3);
    expect(sweep.points.map((p) => p.param)).toEqual([1, 2, 4]);
    expect(sweep.points.every((p) => Number.isFinite(p.avgWait))).toBe(true);
  });

  it('compareAlgorithms ranks all 17 algorithms', () => {
    const rows = compareAlgorithms(workload, { quantum: 2 });
    expect(rows).toHaveLength(17);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].avgWait).toBeLessThanOrEqual(rows[i].avgWait + 1e-9);
    }
  });
});
