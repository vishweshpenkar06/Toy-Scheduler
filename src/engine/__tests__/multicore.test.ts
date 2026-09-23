import { describe, it, expect } from "vitest";
import { Process } from "../../types";
import { runAlgorithm } from "../runAlgorithm";

const workload: Process[] = [
  { pid: "P1", arrivalTime: 0, burstTime: 8, priority: 3 },
  { pid: "P2", arrivalTime: 0, burstTime: 4, priority: 1 },
  { pid: "P3", arrivalTime: 0, burstTime: 6, priority: 2 },
  { pid: "P4", arrivalTime: 0, burstTime: 5, priority: 4 },
  { pid: "P5", arrivalTime: 2, burstTime: 3, priority: 0 },
  { pid: "P6", arrivalTime: 3, burstTime: 7, priority: 2 },
];

function slicesByCore(timeline: { pid: string; start: number; end: number; core?: number }[]) {
  const byCore = new Map<number, { pid: string; start: number; end: number }[]>();
  for (const s of timeline) {
    if (s.pid === "idle") continue;
    const core = s.core ?? 0;
    if (!byCore.has(core)) byCore.set(core, []);
    byCore.get(core)!.push({ pid: s.pid, start: s.start, end: s.end });
  }
  return byCore;
}

function hasOverlap(slices: { start: number; end: number }[]): boolean {
  const sorted = [...slices].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return true;
  }
  return false;
}

describe("true multi-core simulation", () => {
  for (const coreCount of [2, 4]) {
    it(`${coreCount} cores: no process overlaps on the same core`, () => {
      const result = runAlgorithm("fifo", workload, { coreCount });
      const byCore = slicesByCore(result.timeline);
      expect(byCore.size).toBeLessThanOrEqual(coreCount);
      for (const [, slices] of byCore) {
        expect(hasOverlap(slices), `overlap on core`).toBe(false);
      }
    });

    it(`${coreCount} cores: assigns work across multiple cores`, () => {
      const result = runAlgorithm("fifo", workload, { coreCount });
      const byCore = slicesByCore(result.timeline);
      expect(byCore.size).toBeGreaterThan(1);
    });

    it(`${coreCount} cores: completes no later than single-core`, () => {
      const multi = runAlgorithm("fifo", workload, { coreCount });
      const single = runAlgorithm("fifo", workload, { coreCount: 1 });
      const endOf = (r: typeof multi) =>
        r.timeline.reduce((m, s) => Math.max(m, s.end), 0);
      expect(endOf(multi)).toBeLessThanOrEqual(endOf(single));
    });

    it(`${coreCount} cores: metrics recomputed from parallel timeline`, () => {
      const multi = runAlgorithm("fifo", workload, { coreCount });
      const single = runAlgorithm("fifo", workload, { coreCount: 1 });
      // Parallel makespan differs ⇒ turnaround/completion metrics must differ
      const multiEnd = multi.timeline.reduce((m, s) => Math.max(m, s.end), 0);
      const singleEnd = single.timeline.reduce((m, s) => Math.max(m, s.end), 0);
      expect(multiEnd).toBeLessThan(singleEnd);
      expect(multi.averageTurnaroundTime).not.toBe(single.averageTurnaroundTime);
    });

    it(`${coreCount} cores: total executed CPU equals sum of bursts`, () => {
      const result = runAlgorithm("roundRobin", workload, { quantum: 2, coreCount });
      const busy = result.timeline
        .filter((s) => s.pid !== "idle")
        .reduce((sum, s) => sum + (s.end - s.start), 0);
      const total = workload.reduce((s, p) => s + p.burstTime, 0);
      expect(busy).toBe(total);
    });

    it(`${coreCount} cores: per-core utilization <= 100%`, () => {
      const result = runAlgorithm("srtf", workload, { coreCount });
      const span = result.timeline.reduce((m, s) => Math.max(m, s.end), 0);
      const byCore = slicesByCore(result.timeline);
      for (const [, slices] of byCore) {
        const busy = slices.reduce((s, x) => s + (x.end - x.start), 0);
        expect(busy).toBeLessThanOrEqual(span);
        expect(busy / span).toBeLessThanOrEqual(1.0001);
      }
    });
  }

  it("single-core still matches legacy-style sequential schedule", () => {
    const single = runAlgorithm("fifo", workload, { coreCount: 1 });
    // FCFS single core: no two execution slices overlap in time
    const exec = single.timeline.filter((s) => s.pid !== "idle");
    expect(hasOverlap(exec)).toBe(false);
  });

  it("coreCount 1 and default are identical", () => {
    const a = runAlgorithm("priorityPreemptive", workload, { coreCount: 1 });
    const b = runAlgorithm("priorityPreemptive", workload, {});
    expect(a.timeline).toEqual(b.timeline);
  });
});
