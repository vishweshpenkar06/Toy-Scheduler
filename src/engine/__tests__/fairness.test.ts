import { describe, it, expect } from "vitest";
import { Process, SimulationResult } from "../../types";
import { runAlgorithm } from "../runAlgorithm";

function dispatchesIn(result: SimulationResult, limit: number): string[] {
  const events = (result.events ?? []) as { type: string; pid?: string }[];
  const seen: string[] = [];
  for (const event of events) {
    if (event.type !== "DISPATCH" || !event.pid) continue;
    seen.push(event.pid);
    if (seen.length >= limit) break;
  }
  return seen;
}

function pair(weightA: number, weightB: number, burst = 200): Process[] {
  return [
    { pid: "A", arrivalTime: 0, burstTime: burst, weight: weightA },
    { pid: "B", arrivalTime: 0, burstTime: burst, weight: weightB },
  ];
}

const FAIR = ["stride", "wfq"] as const;

describe("weighted fair scheduling", () => {
  for (const algorithm of FAIR) {
    it(`${algorithm} turns a 4:1 weight into roughly 4x the turns`, () => {
      const result = runAlgorithm(algorithm, pair(4, 1), { coreCount: 1, contextSwitchCost: 0 });
      const seen = dispatchesIn(result, 40);
      const a = seen.filter((pid) => pid === "A").length;
      const b = seen.filter((pid) => pid === "B").length;

      expect(a + b, "both processes keep getting turns").toBe(40);
      expect(a, "the heavier process is dispatched more often").toBeGreaterThan(b * 2);
      expect(a, "but not unboundedly so").toBeLessThan(b * 8);
      expect(a / b).toBeCloseTo(4, 0);

      // Equal work, unequal weights: the heavier one finishes first.
      const done = new Map(result.processResults.map((pr) => [pr.pid, pr.completionTime]));
      expect(done.get("A")!).toBeLessThan(done.get("B")!);
    });

    it(`${algorithm} splits an equal-weight pair evenly`, () => {
      const result = runAlgorithm(algorithm, pair(1, 1), { coreCount: 1, contextSwitchCost: 0 });
      const seen = dispatchesIn(result, 20);
      const a = seen.filter((pid) => pid === "A").length;
      const b = seen.filter((pid) => pid === "B").length;
      expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
    });

    it(`${algorithm} is deterministic`, () => {
      const options = { coreCount: 2, contextSwitchCost: 3, quantum: 2 };
      const first = runAlgorithm(algorithm, pair(4, 1), options);
      const second = runAlgorithm(algorithm, pair(4, 1), options);
      expect(second.timeline).toEqual(first.timeline);
      expect(second.processResults).toEqual(first.processResults);
    });

    it(`${algorithm} weights survive a late arrival`, () => {
      // B shows up mid-run with a heavier weight and must earn its turns
      // rather than inheriting the head of the queue.
      const workload: Process[] = [
        { pid: "A", arrivalTime: 0, burstTime: 150, weight: 1 },
        { pid: "B", arrivalTime: 10, burstTime: 150, weight: 3 },
      ];
      const result = runAlgorithm(algorithm, workload, { coreCount: 1, contextSwitchCost: 0 });
      const seen = dispatchesIn(result, 60).filter((pid) => pid === "A" || pid === "B");
      const a = seen.filter((pid) => pid === "A").length;
      const b = seen.filter((pid) => pid === "B").length;
      expect(a + b).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(a);
    });
  }
});
