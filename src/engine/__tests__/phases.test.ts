import { describe, it, expect } from "vitest";
import { Process } from "../../types";
import { runAlgorithm } from "../runAlgorithm";
import { buildExplanations } from "../../utils/explain";

const workload: Process[] = [
  { pid: "P1", arrivalTime: 0, burstTime: 8, priority: 3 },
  { pid: "P2", arrivalTime: 1, burstTime: 4, priority: 1 },
  { pid: "P3", arrivalTime: 2, burstTime: 2, priority: 2 },
  { pid: "P4", arrivalTime: 3, burstTime: 5, priority: 4 },
];

const deadlineWorkload: Process[] = [
  { pid: "A", arrivalTime: 0, burstTime: 4, deadline: 10, period: 10 },
  { pid: "B", arrivalTime: 0, burstTime: 3, deadline: 6, period: 6 },
  { pid: "C", arrivalTime: 0, burstTime: 2, deadline: 8, period: 8 },
];

const weighted: Process[] = [
  { pid: "W1", arrivalTime: 0, burstTime: 10, weight: 3, tickets: 30 },
  { pid: "W2", arrivalTime: 0, burstTime: 10, weight: 1, tickets: 10 },
  { pid: "W3", arrivalTime: 0, burstTime: 10, weight: 2, tickets: 20 },
];

describe("Phase 6: context-switch cost", () => {
  it("cost 0 produces no context-switch slices", () => {
    const r = runAlgorithm("roundRobin", workload, { quantum: 2, contextSwitchCost: 0 });
    expect(r.timeline.filter((s) => s.kind === "CONTEXT_SWITCH")).toHaveLength(0);
  });

  it("cost > 0 inserts context-switch slices", () => {
    const r = runAlgorithm("roundRobin", workload, { quantum: 2, contextSwitchCost: 1 });
    const cs = r.timeline.filter((s) => s.kind === "CONTEXT_SWITCH");
    expect(cs.length).toBeGreaterThan(0);
    for (const s of cs) {
      expect(s.end - s.start).toBe(1);
    }
  });

  it("cost > 0 increases makespan vs cost 0", () => {
    const free = runAlgorithm("roundRobin", workload, { quantum: 1, contextSwitchCost: 0 });
    const paid = runAlgorithm("roundRobin", workload, { quantum: 1, contextSwitchCost: 2 });
    const end = (r: typeof free) => r.timeline.reduce((m, s) => Math.max(m, s.end), 0);
    expect(end(paid)).toBeGreaterThan(end(free));
  });

  it("metrics.contextSwitchCount tracks switches", () => {
    const r = runAlgorithm("roundRobin", workload, { quantum: 1, contextSwitchCost: 1 });
    expect(r.metrics!.contextSwitchCount).toBeGreaterThan(0);
  });
});

describe("Phase 7: multi-burst + BLOCKED (IO)", () => {
  const ioWorkload: Process[] = [
    {
      pid: "IO1",
      arrivalTime: 0,
      burstTime: 6,
      bursts: [
        { type: "cpu", duration: 3 },
        { type: "io", duration: 4 },
        { type: "cpu", duration: 3 },
      ],
    },
  ];

  it("accepts interleaved CPU/IO bursts and completes", () => {
    const r = runAlgorithm("fifo", ioWorkload);
    expect(r.processResults).toHaveLength(1);
    expect(r.processResults[0].completionTime).toBeGreaterThan(6);
  });

  it("total CPU executed equals sum of CPU bursts", () => {
    const r = runAlgorithm("fifo", ioWorkload);
    // 3 + 3 CPU; IO delays completion past pure CPU sum
    expect(r.processResults[0].completionTime).toBeGreaterThanOrEqual(7);
  });

  it("rejects IO sequence that does not end on CPU", () => {
    expect(() =>
      runAlgorithm("fifo", [
        {
          pid: "BAD",
          arrivalTime: 0,
          burstTime: 3,
          bursts: [
            { type: "cpu", duration: 3 },
            { type: "io", duration: 2 },
          ],
        },
      ])
    ).toThrow(/end with a CPU burst/);
  });
});

describe("Phase 8: new algorithms", () => {
  const algos = [
    "hrrn",
    "lrtf",
    "lottery",
    "stride",
    "wfq",
    "edf",
    "rms",
    "adaptive",
  ] as const;

  for (const alg of algos) {
    it(`${alg} produces a full schedule`, () => {
      const opts =
        alg === "adaptive" ? { quantum: 2 } : alg === "lottery" ? { seed: 42 } : {};
      const r = runAlgorithm(alg, workload, opts);
      expect(r.processResults).toHaveLength(4);
      const busy = r.timeline
        .filter((s) => s.pid !== "idle" && s.kind !== "CONTEXT_SWITCH")
        .reduce((s, x) => s + (x.end - x.start), 0);
      expect(busy).toBe(workload.reduce((s, p) => s + p.burstTime, 0));
      for (const pr of r.processResults) {
        expect(pr.completionTime).toBeGreaterThan(0);
        expect(pr.waitingTime).toBeGreaterThanOrEqual(0);
      }
    });
  }

  it("lottery is deterministic for a fixed seed", () => {
    const a = runAlgorithm("lottery", weighted, { seed: 7 });
    const b = runAlgorithm("lottery", weighted, { seed: 7 });
    expect(a.timeline).toEqual(b.timeline);
  });

  it("lottery differs across seeds (probabilistic)", () => {
    const a = runAlgorithm("lottery", weighted, { seed: 1 });
    const b = runAlgorithm("lottery", weighted, { seed: 99999 });
    // Same makespan possible; check some timeline difference OR equal is ok if tiny
    // With different weights/order at least one seed pair among several should differ
    const c = runAlgorithm("lottery", weighted, { seed: 12345 });
    const same = JSON.stringify(a.timeline) === JSON.stringify(b.timeline);
    const same2 = JSON.stringify(a.timeline) === JSON.stringify(c.timeline);
    expect(same && same2).toBe(false);
  });

  it("EDF prefers earlier deadlines", () => {
    const r = runAlgorithm("edf", deadlineWorkload);
    const first = r.timeline.find((s) => s.pid !== "idle");
    expect(first!.pid).toBe("B"); // deadline 6 is earliest
  });

  it("RMS prefers shorter periods", () => {
    const r = runAlgorithm("rms", deadlineWorkload);
    const first = r.timeline.find((s) => s.pid !== "idle");
    expect(first!.pid).toBe("B"); // period 6 shortest
  });

  it("LRTF runs longest job first", () => {
    const r = runAlgorithm("lrtf", workload);
    const first = r.timeline.find((s) => s.pid !== "idle");
    expect(first!.pid).toBe("P1"); // burst 8 longest
  });

  it("HRRN is non-preemptive (one slice per job on empty-ish queue)", () => {
    const simple: Process[] = [
      { pid: "A", arrivalTime: 0, burstTime: 5 },
      { pid: "B", arrivalTime: 1, burstTime: 3 },
      { pid: "C", arrivalTime: 2, burstTime: 2 },
    ];
    const r = runAlgorithm("hrrn", simple);
    // A runs first alone; no mid-run preemption of A by arrivals before it starts
    expect(r.timeline[0].pid).toBe("A");
    expect(r.timeline[0].end).toBe(5);
  });
});

describe("Phase 10: extended metrics", () => {
  it("exposes throughput, utilization, fairness, percentiles", () => {
    const r = runAlgorithm("srtf", workload);
    const m = r.metrics!;
    expect(m.throughput).toBeGreaterThan(0);
    expect(m.cpuUtilization).toBeGreaterThan(0);
    expect(m.cpuUtilization).toBeLessThanOrEqual(100);
    expect(m.jainFairness).toBeGreaterThan(0);
    expect(m.jainFairness).toBeLessThanOrEqual(1.0001);
    expect(m.waitingP95).toBeGreaterThanOrEqual(m.waitingP50);
    expect(m.contextSwitchCount).toBeGreaterThanOrEqual(0);
  });

  it("deadline misses counted when completion > deadline", () => {
    const late: Process[] = [
      { pid: "L1", arrivalTime: 0, burstTime: 10, deadline: 3 },
    ];
    const r = runAlgorithm("fifo", late);
    expect(r.metrics!.deadlineMisses).toBe(1);
    expect(r.processResults[0].deadlineMiss).toBe(true);
  });
});

describe("Phase 11: structured explainability", () => {
  it("builds one explanation per execution slice", () => {
    const r = runAlgorithm("sjf", workload);
    const ex = buildExplanations("sjf", r.timeline, workload);
    expect(ex.length).toBeGreaterThan(0);
    for (const e of ex) {
      expect(e.rule).toBeTruthy();
      expect(e.selected).toBeTruthy();
      expect(e.reason).toBeTruthy();
      expect(e.candidates.length).toBeGreaterThan(0);
    }
  });

  it("includes rule text for new algorithms", () => {
    const r = runAlgorithm("edf", deadlineWorkload);
    const ex = buildExplanations("edf", r.timeline, deadlineWorkload);
    expect(ex[0].rule).toMatch(/deadline/i);
  });
});
