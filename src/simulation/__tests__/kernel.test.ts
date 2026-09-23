import { describe, it, expect } from "vitest";
import { SimulationKernel } from "../SimulationKernel";
import { fcfsPolicy, sjfPolicy } from "../policies";
import { fifo, sjf } from "../../engine/scheduler";
import { Process } from "../../types";

const workload: Process[] = [
  { pid: "P1", arrivalTime: 0, burstTime: 8, priority: 3 },
  { pid: "P2", arrivalTime: 1, burstTime: 4, priority: 1 },
  { pid: "P3", arrivalTime: 2, burstTime: 2, priority: 2 },
  { pid: "P4", arrivalTime: 3, burstTime: 5, priority: 4 },
];

function execTimeline(timeline: { pid: string; start: number; end: number }[]): string {
  return timeline
    .filter((s) => s.pid !== "idle")
    .map((s) => `${s.pid}:${s.start}-${s.end}`)
    .join(" ");
}

function coreMetrics(results: { pid: string; waitingTime: number; turnaroundTime: number; responseTime: number; completionTime: number }[]) {
  return results.map((r) => ({
    pid: r.pid,
    waitingTime: r.waitingTime,
    turnaroundTime: r.turnaroundTime,
    responseTime: r.responseTime,
    completionTime: r.completionTime,
  }));
}

describe("SimulationKernel FCFS parity with legacy fifo", () => {
  it("produces identical execution timeline", () => {
    const legacy = fifo(workload);
    const kernel = new SimulationKernel(fcfsPolicy).run(workload);
    expect(execTimeline(kernel.timeline)).toBe(execTimeline(legacy.timeline));
  });

  it("produces identical process metrics", () => {
    const legacy = fifo(workload);
    const kernel = new SimulationKernel(fcfsPolicy).run(workload);
    expect(coreMetrics(kernel.processResults)).toEqual(coreMetrics(legacy.processResults));
    expect(kernel.averageWaitingTime).toBeCloseTo(legacy.averageWaitingTime, 10);
    expect(kernel.averageTurnaroundTime).toBeCloseTo(legacy.averageTurnaroundTime, 10);
    expect(kernel.averageResponseTime).toBeCloseTo(legacy.averageResponseTime, 10);
  });
});

describe("SimulationKernel SJF parity with legacy sjf", () => {
  it("produces identical execution timeline", () => {
    const legacy = sjf(workload);
    const kernel = new SimulationKernel(sjfPolicy).run(workload);
    expect(execTimeline(kernel.timeline)).toBe(execTimeline(legacy.timeline));
  });

  it("produces identical process metrics", () => {
    const legacy = sjf(workload);
    const kernel = new SimulationKernel(sjfPolicy).run(workload);
    expect(coreMetrics(kernel.processResults)).toEqual(coreMetrics(legacy.processResults));
  });
});

describe("SimulationKernel event trace", () => {
  it("records arrivals and dispatches", () => {
    const result = new SimulationKernel(fcfsPolicy).run(workload);
    const events = result.events!;
    expect(events.filter((e) => e.type === "PROCESS_ARRIVAL")).toHaveLength(4);
    expect(events.filter((e) => e.type === "DISPATCH")).toHaveLength(4);
    expect(events.filter((e) => e.type === "PROCESS_TERMINATE")).toHaveLength(4);
  });

  it("emits events in non-decreasing time order", () => {
    const result = new SimulationKernel(fcfsPolicy).run(workload);
    const events = result.events!;
    for (let i = 1; i < events.length; i++) {
      expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time);
    }
  });
});

describe("SimulationKernel invariants", () => {
  it("empty workload returns empty result", () => {
    const result = new SimulationKernel(fcfsPolicy).run([]);
    expect(result.timeline).toEqual([]);
    expect(result.processResults).toEqual([]);
  });

  it("rejects duplicate pids", () => {
    expect(() =>
      new SimulationKernel(fcfsPolicy).run([
        { pid: "P1", arrivalTime: 0, burstTime: 3 },
        { pid: "P1", arrivalTime: 1, burstTime: 2 },
      ])
    ).toThrow(/Duplicate process ID/);
  });

  it("rejects invalid burst", () => {
    expect(() =>
      new SimulationKernel(fcfsPolicy).run([{ pid: "P1", arrivalTime: 0, burstTime: 0 }])
    ).toThrow();
  });

  it("no process runs before arrival", () => {
    const result = new SimulationKernel(fcfsPolicy).run(workload);
    const arrivals = new Map(workload.map((p) => [p.pid, p.arrivalTime]));
    for (const slice of result.timeline) {
      if (slice.pid !== "idle") {
        expect(slice.start).toBeGreaterThanOrEqual(arrivals.get(slice.pid)!);
      }
    }
  });

  it("timeline is ordered by start", () => {
    const result = new SimulationKernel(fcfsPolicy).run(workload);
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].start).toBeGreaterThanOrEqual(result.timeline[i - 1].start);
    }
  });

  it("completion >= arrival and waiting >= 0", () => {
    const result = new SimulationKernel(fcfsPolicy).run(workload);
    for (const r of result.processResults) {
      const arrival = workload.find((p) => p.pid === r.pid)!.arrivalTime;
      expect(r.completionTime).toBeGreaterThanOrEqual(arrival);
      expect(r.waitingTime).toBeGreaterThanOrEqual(0);
      expect(r.turnaroundTime).toBeGreaterThanOrEqual(0);
    }
  });

  it("execution total equals sum of bursts", () => {
    const result = new SimulationKernel(fcfsPolicy).run(workload);
    const busy = result.timeline
      .filter((s) => s.pid !== "idle")
      .reduce((sum, s) => sum + (s.end - s.start), 0);
    const totalBurst = workload.reduce((s, p) => s + p.burstTime, 0);
    expect(busy).toBe(totalBurst);
  });
});
