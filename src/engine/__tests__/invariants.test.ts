import { describe, it, expect } from "vitest";
import { AlgorithmType, Process, SimulationResult, TimelineSlice } from "../../types";
import { runAlgorithm } from "../runAlgorithm";

const ALGORITHMS: AlgorithmType[] = [
  "fifo",
  "sjf",
  "srtf",
  "roundRobin",
  "priorityNonPreemptive",
  "priorityPreemptive",
  "priorityAging",
  "multiLevelQueue",
  "multiLevelFeedback",
  "hrrn",
  "lrtf",
  "lottery",
  "stride",
  "wfq",
  "edf",
  "rms",
  "adaptive",
];

const mixed: Process[] = [
  { pid: "P1", arrivalTime: 0, burstTime: 8, priority: 3 },
  { pid: "P2", arrivalTime: 0, burstTime: 4, priority: 1 },
  { pid: "P3", arrivalTime: 1, burstTime: 6, priority: 2 },
  { pid: "P4", arrivalTime: 2, burstTime: 5, priority: 4 },
  { pid: "P5", arrivalTime: 2, burstTime: 3, priority: 0 },
  { pid: "P6", arrivalTime: 3, burstTime: 7, priority: 2 },
];

const withIO: Process[] = [
  {
    pid: "IO1",
    arrivalTime: 0,
    burstTime: 6,
    priority: 2,
    bursts: [
      { type: "cpu", duration: 3 },
      { type: "io", duration: 4 },
      { type: "cpu", duration: 3 },
    ],
  },
  {
    pid: "IO2",
    arrivalTime: 1,
    burstTime: 5,
    priority: 1,
    bursts: [
      { type: "cpu", duration: 2 },
      { type: "io", duration: 3 },
      { type: "cpu", duration: 3 },
    ],
  },
  { pid: "IO3", arrivalTime: 0, burstTime: 4, priority: 3 },
];

const realtime: Process[] = [
  { pid: "RT1", arrivalTime: 0, burstTime: 3, deadline: 40, period: 12 },
  { pid: "RT2", arrivalTime: 1, burstTime: 2, deadline: 30, period: 8 },
  { pid: "RT3", arrivalTime: 2, burstTime: 4, deadline: 50, period: 20 },
];

const cpuTotal = (p: Process) =>
  p.bursts
    ? p.bursts.filter((b) => b.type === "cpu").reduce((sum, b) => sum + b.duration, 0)
    : p.burstTime;

function spanOf(timeline: TimelineSlice[]): number {
  return timeline.reduce((m, s) => Math.max(m, s.end), 0);
}

function assertSchedulingInvariants(
  label: string,
  result: SimulationResult,
  workload: Process[],
  coreCount: number,
): void {
  const at = (m: string) => `${label}: ${m}`;

  for (const slice of result.timeline) {
    expect(Number.isFinite(slice.start), at(`${slice.pid} start is finite`)).toBe(true);
    expect(Number.isFinite(slice.end), at(`${slice.pid} end is finite`)).toBe(true);
    expect(slice.start, at(`${slice.pid} start >= 0`)).toBeGreaterThanOrEqual(0);
    expect(slice.end, at(`${slice.pid} end >= start`)).toBeGreaterThanOrEqual(slice.start);

    if (slice.kind === "IO") {
      expect(slice.core, at(`I/O for ${slice.pid} must be off-core`)).toBeUndefined();
    } else if (slice.core !== undefined) {
      expect(slice.core, at(`${slice.pid} core index`)).toBeGreaterThanOrEqual(0);
      expect(slice.core, at(`${slice.pid} core index`)).toBeLessThan(coreCount);
    }
  }

  const span = spanOf(result.timeline);

  // One slice at a time per core, across every core-bearing kind.
  const byCore = new Map<number, TimelineSlice[]>();
  for (const slice of result.timeline) {
    if (slice.kind === "IO" || slice.core === undefined) continue;
    if (!byCore.has(slice.core)) byCore.set(slice.core, []);
    byCore.get(slice.core)!.push(slice);
  }
  for (const [core, slices] of byCore) {
    const ordered = [...slices].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
      expect(
        ordered[i].start,
        at(`core ${core} overlap: ${JSON.stringify(ordered[i - 1])} / ${JSON.stringify(ordered[i])}`)
      ).toBeGreaterThanOrEqual(ordered[i - 1].end);
    }
    const busy = slices
      .filter((s) => s.kind !== "IDLE")
      .reduce((sum, s) => sum + (s.end - s.start), 0);
    expect(busy, at(`core ${core} utilization`)).toBeLessThanOrEqual(span);
  }

  // A process is never in two places at once, even across cores. Idle slots
  // share the synthetic pid "idle" and legitimately run on several cores at
  // once, so they are excluded here and checked per core above.
  const byPid = new Map<string, TimelineSlice[]>();
  for (const slice of result.timeline) {
    if (slice.kind === "IO" || slice.pid === "idle") continue;
    if (!byPid.has(slice.pid)) byPid.set(slice.pid, []);
    byPid.get(slice.pid)!.push(slice);
  }
  for (const [pid, slices] of byPid) {
    const ordered = [...slices].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
      expect(
        ordered[i].start,
        at(`${pid} overlaps itself: ${JSON.stringify(ordered[i - 1])} / ${JSON.stringify(ordered[i])}`)
      ).toBeGreaterThanOrEqual(ordered[i - 1].end);
    }
  }

  // Every declared CPU cycle is executed exactly once.
  for (const spec of workload) {
    const executed = result.timeline
      .filter((s) => s.pid === spec.pid && s.kind === "EXECUTION")
      .reduce((sum, s) => sum + (s.end - s.start), 0);
    expect(executed, at(`${spec.pid} CPU conservation: executed ${executed}, declared ${cpuTotal(spec)}`))
      .toBe(cpuTotal(spec));
  }

  // Nothing completes before it arrived or before its last slice ended.
  for (const pr of result.processResults) {
    const spec = workload.find((p) => p.pid === pr.pid);
    expect(pr.completionTime, at(`${pr.pid} completion >= arrival`)).toBeGreaterThanOrEqual(
      spec?.arrivalTime ?? 0
    );
    const lastEnd = result.timeline
      .filter((s) => s.pid === pr.pid)
      .reduce((m, s) => Math.max(m, s.end), 0);
    expect(pr.completionTime, at(`${pr.pid} completion >= last slice end`)).toBeGreaterThanOrEqual(lastEnd);
  }
}

describe("scheduling invariants hold for every algorithm", () => {
  for (const workload of [mixed, withIO, realtime]) {
    for (const coreCount of [1, 2, 4]) {
      for (const contextSwitchCost of [0, 5]) {
        it(`${workload === mixed ? "mixed" : workload === withIO ? "withIO" : "realtime"} / ${coreCount} core(s) / cs=${contextSwitchCost}`, () => {
          for (const algorithm of ALGORITHMS) {
            const result = runAlgorithm(algorithm, workload, { quantum: 2, coreCount, contextSwitchCost });
            assertSchedulingInvariants(algorithm, result, workload, coreCount);
          }
        });
      }
    }
  }
});
