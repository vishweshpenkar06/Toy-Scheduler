import { describe, it, expect } from "vitest";

import { Process } from "../../types";
import { runAlgorithm } from "../runAlgorithm";
import { SimulationKernel } from "../../simulation/SimulationKernel";
import { SchedulerPolicy, SchedulerContext } from "../../simulation/policy";
import { lrtfPolicy, srtfPolicy, adaptivePolicy } from "../../simulation/policies";
import { createRuntime, toProcessSpec } from "../../domain/bridge";
import { DEFAULT_SYSTEM_CONFIG, ProcessRuntime } from "../../domain/models";

const ioWorkload: Process[] = [
  {
    pid: "IO1",
    arrivalTime: 0,
    burstTime: 6,
    priority: 1,
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
    priority: 2,
    bursts: [
      { type: "cpu", duration: 2 },
      { type: "io", duration: 3 },
      { type: "cpu", duration: 3 },
    ],
  },
  { pid: "IO3", arrivalTime: 0, burstTime: 4, priority: 3 },
];

type SliceLike = { pid: string; start: number; end: number; kind?: string; core?: number };

function makeCtx(time: number, ready: ProcessRuntime[] = []): SchedulerContext {
  return {
    time,
    cores: [],
    ready,
    all: new Map(),
    system: DEFAULT_SYSTEM_CONFIG,
    schedule: () => undefined,
    random: () => 0,
  };
}

describe("Phase 35 regressions", () => {
  describe("defect 1: context switches and I/O never overlap on one core", () => {
    for (const coreCount of [1, 2, 4]) {
      it(`${coreCount} core(s) with contextSwitchCost 5`, () => {
        const result = runAlgorithm("roundRobin", ioWorkload, {
          quantum: 2,
          coreCount,
          contextSwitchCost: 5,
        });

        // I/O happens off-core: the process released its core while blocked.
        for (const slice of result.timeline) {
          if (slice.kind === "IO") expect(slice.core, slice.pid).toBeUndefined();
        }

        const byCore = new Map<number, SliceLike[]>();
        for (const slice of result.timeline as SliceLike[]) {
          if (slice.kind === "IO") continue;
          const core = slice.core ?? 0;
          if (!byCore.has(core)) byCore.set(core, []);
          byCore.get(core)!.push(slice);
        }

        for (const [core, slices] of byCore) {
          const ordered = [...slices].sort((a, b) => a.start - b.start);
          for (let i = 1; i < ordered.length; i++) {
            expect(ordered[i].start, `core ${core}: ${JSON.stringify(ordered[i - 1])} -> ${JSON.stringify(ordered[i])}`)
              .toBeGreaterThanOrEqual(ordered[i - 1].end);
          }
        }
      });
    }
  });

  describe("defect 2: a context switch is counted exactly once", () => {
    it("per-process switches equal dispatches minus the first run", () => {
      const workload: Process[] = [
        { pid: "A", arrivalTime: 0, burstTime: 6 },
        { pid: "B", arrivalTime: 0, burstTime: 6 },
        { pid: "C", arrivalTime: 0, burstTime: 6 },
      ];
      const result = runAlgorithm("roundRobin", workload, {
        quantum: 2,
        coreCount: 1,
        contextSwitchCost: 3,
      });

      const events = (result.events ?? []) as { type: string; pid?: string }[];
      const dispatches = new Map<string, number>();
      for (const event of events) {
        if (event.type === "DISPATCH" && event.pid) {
          dispatches.set(event.pid, (dispatches.get(event.pid) ?? 0) + 1);
        }
      }

      for (const pr of result.processResults) {
        expect(pr.contextSwitches, pr.pid).toBe((dispatches.get(pr.pid) ?? 1) - 1);
      }

      const csSlices = result.timeline.filter((s) => s.kind === "CONTEXT_SWITCH").length;
      expect(result.metrics?.contextSwitchCount).toBe(csSlices);
    });
  });

  describe("defect 3: no timeline slice is truncated away", () => {
    it("executed CPU equals declared CPU for every process", () => {
      for (const algorithm of ["fifo", "srtf", "roundRobin", "priorityPreemptive", "lrtf"] as const) {
        const result = runAlgorithm(algorithm, ioWorkload, {
          quantum: 2,
          coreCount: 2,
          contextSwitchCost: 4,
        });
        for (const spec of ioWorkload) {
          const executed = result.timeline
            .filter((s) => s.pid === spec.pid && s.kind === "EXECUTION")
            .reduce((sum, s) => sum + (s.end - s.start), 0);
          expect(executed, `${algorithm}/${spec.pid}`).toBe(spec.burstTime);
        }
      }
    });
  });

  describe("defect 4: LRTF yields the shortest running job", () => {
    it("preempts the shortest of the running jobs, not the longest", () => {
      const workload: Process[] = [
        { pid: "A", arrivalTime: 0, burstTime: 2 },
        { pid: "C", arrivalTime: 0, burstTime: 5 },
        { pid: "B", arrivalTime: 1, burstTime: 99 },
      ];
      const result = runAlgorithm("lrtf", workload, { coreCount: 2 });
      const events = (result.events ?? []) as { type: string; pid?: string }[];
      const preemption = events.find((e) => e.type === "PREEMPT");
      expect(preemption, "expected a preemption").toBeDefined();
      expect(preemption!.pid).toBe("A");
    });

    it("orders victims shortest-first; SRTF keeps the default", () => {
      const short = createRuntime(toProcessSpec({ pid: "S", arrivalTime: 0, burstTime: 1 }));
      const long = createRuntime(toProcessSpec({ pid: "L", arrivalTime: 0, burstTime: 9 }));
      short.remainingCpu = 1;
      long.remainingCpu = 9;
      expect(lrtfPolicy.victimScore!(short)).toBeGreaterThan(lrtfPolicy.victimScore!(long));
      expect(srtfPolicy.victimScore).toBeUndefined();
    });
  });

  describe("defect 5: an aging tick never force-stops a winning incumbent", () => {
    it("keeps the dominant process in one contiguous slice", () => {
      const workload: Process[] = [
        { pid: "P1", arrivalTime: 0, burstTime: 10, priority: 0 },
        { pid: "P2", arrivalTime: 0, burstTime: 10, priority: 5 },
      ];
      const result = runAlgorithm("priorityAging", workload, {
        coreCount: 1,
        contextSwitchCost: 0,
      });
      const p1 = result.timeline.filter((s) => s.pid === "P1" && s.kind === "EXECUTION");
      expect(p1.length).toBe(1);
      expect(p1[0].start).toBe(0);
      expect(p1[0].end).toBe(10);
    });
  });

  describe("defect 6: dispatch terminates for an always-preempting policy", () => {
    it("does not recurse without bound", () => {
      const thrash: SchedulerPolicy = {
        id: "thrash",
        name: "Always preempt",
        selectNext: (candidates) => candidates[0] ?? null,
        shouldPreempt: () => true,
      };
      const workload: Process[] = [
        { pid: "A", arrivalTime: 0, burstTime: 3 },
        { pid: "B", arrivalTime: 0, burstTime: 3 },
      ];
      expect(() =>
        new SimulationKernel(thrash, { system: { coreCount: 1 } }).run(workload)
      ).not.toThrow();
    });
  });

  describe("defect 7: the adaptive quantum actually moves", () => {
    const spec = toProcessSpec({ pid: "A", arrivalTime: 0, burstTime: 16 });
    const other = createRuntime(toProcessSpec({ pid: "B", arrivalTime: 0, burstTime: 16 }));

    it("shrinks on a full slice while others are waiting, then recovers", () => {
      const policy = adaptivePolicy(4);
      const rt = createRuntime(spec);
      rt.readySince = 0;

      expect(policy.quantumFor!(rt)).toBe(4);

      const competing = makeCtx(10, [other]);
      policy.onProcessStop!(rt, "QUANTUM_EXPIRED", competing);
      expect(policy.quantumFor!(rt)).toBe(2);
      policy.onProcessStop!(rt, "QUANTUM_EXPIRED", competing);
      expect(policy.quantumFor!(rt)).toBe(1);

      // Starved for 10 ticks: grow back toward the base quantum.
      policy.onProcessRun!(rt, 1, makeCtx(10, [other]));
      expect(policy.quantumFor!(rt)).toBe(2);
      policy.onProcessRun!(rt, 1, makeCtx(10, [other]));
      expect(policy.quantumFor!(rt)).toBe(4);
      policy.onProcessRun!(rt, 1, makeCtx(10, [other]));
      expect(policy.quantumFor!(rt)).toBe(4);

      // Completed work resets to the base quantum.
      policy.onProcessStop!(rt, "QUANTUM_EXPIRED", competing);
      expect(policy.quantumFor!(rt)).toBe(2);
      policy.onProcessStop!(rt, "COMPLETED", competing);
      expect(policy.quantumFor!(rt)).toBe(4);
    });

    it("does not grow while nobody else is waiting", () => {
      const policy = adaptivePolicy(4);
      const rt = createRuntime(spec);
      rt.readySince = 0;
      policy.onProcessStop!(rt, "QUANTUM_EXPIRED", makeCtx(10, [other]));
      expect(policy.quantumFor!(rt)).toBe(2);
      policy.onProcessRun!(rt, 1, makeCtx(10));
      expect(policy.quantumFor!(rt)).toBe(2);
    });
  });
});
