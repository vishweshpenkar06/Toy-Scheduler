import { describe, it, expect } from "vitest";
import { Process, AlgorithmType } from "../../types";
import { runAlgorithmOnKernel } from "../runAlgorithm";
import {
  fifo,
  sjf,
  srtf,
  roundRobin,
  priorityScheduling,
  priorityAgingScheduling,
  multiLevelQueueScheduling,
  multiLevelFeedbackQueueScheduling,
} from "../scheduler";

function execTimeline(timeline: { pid: string; start: number; end: number }[]): string {
  return timeline
    .filter((s) => s.pid !== "idle")
    .map((s) => `${s.pid}:${s.start}-${s.end}`)
    .join(" ");
}

const classic: Process[] = [
  { pid: "P1", arrivalTime: 0, burstTime: 8, priority: 3 },
  { pid: "P2", arrivalTime: 1, burstTime: 4, priority: 1 },
  { pid: "P3", arrivalTime: 2, burstTime: 2, priority: 2 },
  { pid: "P4", arrivalTime: 3, burstTime: 5, priority: 4 },
];

const staggered: Process[] = [
  { pid: "A", arrivalTime: 0, burstTime: 7, priority: 2 },
  { pid: "B", arrivalTime: 2, burstTime: 4, priority: 0 },
  { pid: "C", arrivalTime: 4, burstTime: 1, priority: 1 },
  { pid: "D", arrivalTime: 6, burstTime: 9, priority: 3 },
  { pid: "E", arrivalTime: 8, burstTime: 3, priority: 1 },
];

const simultaneous: Process[] = [
  { pid: "P1", arrivalTime: 0, burstTime: 6, priority: 1 },
  { pid: "P2", arrivalTime: 0, burstTime: 4, priority: 1 },
  { pid: "P3", arrivalTime: 0, burstTime: 5, priority: 0 },
  { pid: "P4", arrivalTime: 0, burstTime: 3, priority: 2 },
];

const workloads: [string, Process[]][] = [
  ["classic", classic],
  ["staggered", staggered],
  ["simultaneous", simultaneous],
];

function coreMetrics(results: { pid: string; waitingTime: number; turnaroundTime: number; responseTime: number; completionTime: number }[]) {
  return results.map((r) => ({
    pid: r.pid,
    waitingTime: r.waitingTime,
    turnaroundTime: r.turnaroundTime,
    responseTime: r.responseTime,
    completionTime: r.completionTime,
  }));
}

function expectParity(
  algorithm: AlgorithmType,
  procs: Process[],
  legacyFn: () => ReturnType<typeof fifo>,
  quantum?: number,
  label = ""
) {
  const legacy = legacyFn();
  const kernel = runAlgorithmOnKernel(algorithm, procs, { quantum });
  expect(
    execTimeline(kernel.timeline),
    `${algorithm} timeline ${label}`
  ).toBe(execTimeline(legacy.timeline));
  expect(coreMetrics(kernel.processResults), `${algorithm} metrics ${label}`).toEqual(
    coreMetrics(legacy.processResults)
  );
  expect(kernel.averageWaitingTime).toBeCloseTo(legacy.averageWaitingTime, 10);
  expect(kernel.averageTurnaroundTime).toBeCloseTo(legacy.averageTurnaroundTime, 10);
  expect(kernel.averageResponseTime).toBeCloseTo(legacy.averageResponseTime, 10);
}

function expectAllWorkloads(
  algorithm: AlgorithmType,
  legacyFn: (procs: Process[]) => ReturnType<typeof fifo>,
  quantum?: number
) {
  for (const [name, procs] of workloads) {
    expectParity(algorithm, procs, () => legacyFn(procs), quantum, `@ ${name}`);
  }
}

describe("kernel ↔ legacy parity (all 9 algorithms)", () => {
  it("FCFS", () => {
    expectAllWorkloads("fifo", (p) => fifo(p));
  });

  it("SJF", () => {
    expectAllWorkloads("sjf", (p) => sjf(p));
  });

  it("SRTF", () => {
    expectAllWorkloads("srtf", (p) => srtf(p));
  });

  it("Round Robin q=2", () => {
    expectAllWorkloads("roundRobin", (p) => roundRobin(p, { quantum: 2 }), 2);
  });

  it("Round Robin q=1", () => {
    expectAllWorkloads("roundRobin", (p) => roundRobin(p, { quantum: 1 }), 1);
  });

  it("Round Robin q=4", () => {
    expectAllWorkloads("roundRobin", (p) => roundRobin(p, { quantum: 4 }), 4);
  });

  it("Priority non-preemptive", () => {
    expectAllWorkloads("priorityNonPreemptive", (p) => priorityScheduling(p, { preemptive: false }));
  });

  it("Priority preemptive", () => {
    expectAllWorkloads("priorityPreemptive", (p) => priorityScheduling(p, { preemptive: true }));
  });

  it("Priority + aging", () => {
    expectAllWorkloads("priorityAging", (p) =>
      priorityAgingScheduling(p, { agingInterval: 3, agingAmount: 1 })
    );
  });

  it("Multilevel queue", () => {
    const queues = [
      { name: "System", priorityRange: { min: 0, max: 1 } },
      { name: "Interactive", priorityRange: { min: 2, max: 3 } },
      { name: "Batch", priorityRange: { min: 4, max: Number.MAX_SAFE_INTEGER } },
    ];
    expectAllWorkloads("multiLevelQueue", (p) => multiLevelQueueScheduling(p, { queues }));
  });

  it("MLFQ", () => {
    const opts = {
      quantumPerLevel: [2, 4, 8],
      agingPromotionInterval: 10,
      demotionThreshold: 2,
    };
    expectAllWorkloads("multiLevelFeedback", (p) => multiLevelFeedbackQueueScheduling(p, opts));
  });
});

describe("kernel runAlgorithm validation", () => {
  it("throws on invalid RR quantum", () => {
    expect(() => runAlgorithmOnKernel("roundRobin", classic, { quantum: 0 })).toThrow(
      /Invalid quantum/
    );
    expect(() => runAlgorithmOnKernel("roundRobin", classic, { quantum: 1.5 })).toThrow(
      /Invalid quantum/
    );
  });

  it("throws on duplicate pids", () => {
    expect(() =>
      runAlgorithmOnKernel("fifo", [
        { pid: "X", arrivalTime: 0, burstTime: 1 },
        { pid: "X", arrivalTime: 1, burstTime: 1 },
      ])
    ).toThrow(/Duplicate/);
  });

  it("empty workload → zeroed result", () => {
    const r = runAlgorithmOnKernel("fifo", []);
    expect(r.timeline).toEqual([]);
    expect(r.averageWaitingTime).toBe(0);
  });
});
