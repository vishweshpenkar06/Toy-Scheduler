import { describe, it, expect } from "vitest";
import { Process } from "../../types";
import { fifo, sjf, srtf, roundRobin, priorityScheduling } from "../scheduler";

describe("FIFO Scheduling", () => {
  it("should handle basic 3-process FIFO with staggered arrival times", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 8 },
      { pid: "P2", arrivalTime: 1, burstTime: 4 },
      { pid: "P3", arrivalTime: 2, burstTime: 2 },
    ];

    const result = fifo(processes);

    // Timeline should be: P1(0-8), P2(8-12), P3(12-14)
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 8 },
      { pid: "P2", start: 8, end: 12 },
      { pid: "P3", start: 12, end: 14 },
    ]);

    // Verify metrics
    expect(result.processResults[0]).toEqual({
      pid: "P1",
      waitingTime: 0,
      turnaroundTime: 8,
      responseTime: 0,
      completionTime: 8,
    });

    expect(result.processResults[1]).toEqual({
      pid: "P2",
      waitingTime: 7,
      turnaroundTime: 11,
      responseTime: 7,
      completionTime: 12,
    });

    expect(result.processResults[2]).toEqual({
      pid: "P3",
      waitingTime: 10,
      turnaroundTime: 12,
      responseTime: 10,
      completionTime: 14,
    });

    expect(result.averageWaitingTime).toBeCloseTo((0 + 7 + 10) / 3);
    expect(result.averageTurnaroundTime).toBeCloseTo((8 + 11 + 12) / 3);
  });

  it("should handle single process", () => {
    const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: 5 }];

    const result = fifo(processes);

    expect(result.timeline).toEqual([{ pid: "P1", start: 0, end: 5 }]);
    expect(result.processResults[0].waitingTime).toBe(0);
    expect(result.processResults[0].turnaroundTime).toBe(5);
  });

  it("should handle empty process list", () => {
    const result = fifo([]);

    expect(result.timeline).toEqual([]);
    expect(result.processResults).toEqual([]);
    expect(result.averageWaitingTime).toBe(0);
  });

  it("should handle unsorted input (processes not ordered by arrival time)", () => {
    const processes: Process[] = [
      { pid: "P3", arrivalTime: 2, burstTime: 2 },
      { pid: "P1", arrivalTime: 0, burstTime: 8 },
      { pid: "P2", arrivalTime: 1, burstTime: 4 },
    ];

    const result = fifo(processes);

    // Should produce same result regardless of input order
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 8 },
      { pid: "P2", start: 8, end: 12 },
      { pid: "P3", start: 12, end: 14 },
    ]);
  });
});

describe("SJF Scheduling", () => {
  it("should handle classic SJF example", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 8 },
      { pid: "P2", arrivalTime: 1, burstTime: 4 },
      { pid: "P3", arrivalTime: 2, burstTime: 2 },
    ];

    const result = sjf(processes);

    // With SJF: P1 starts at 0 (arrives first), then P3 at 2 (shortest), then P2
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 8 },
      { pid: "P3", start: 8, end: 10 },
      { pid: "P2", start: 10, end: 14 },
    ]);
  });

  it("should demonstrate SJF starvation problem", () => {
    // Long process arrives first, but short processes keep arriving
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 10 },
      { pid: "P2", arrivalTime: 1, burstTime: 1 },
      { pid: "P3", arrivalTime: 2, burstTime: 1 },
      { pid: "P4", arrivalTime: 3, burstTime: 1 },
    ];

    const result = sjf(processes);

    // P1 runs first (no other choice), then P2, P3, P4 in order
    expect(result.timeline[0].pid).toBe("P1");
    expect(result.timeline[0].end).toBe(10);
    expect(result.timeline[1].pid).toBe("P2");
    expect(result.timeline[2].pid).toBe("P3");
    expect(result.timeline[3].pid).toBe("P4");
  });

  it("should break ties by PID order", () => {
    const processes: Process[] = [
      { pid: "P2", arrivalTime: 0, burstTime: 5 },
      { pid: "P1", arrivalTime: 0, burstTime: 5 },
      { pid: "P3", arrivalTime: 0, burstTime: 5 },
    ];

    const result = sjf(processes);

    // All have same burst time, should be ordered by PID
    expect(result.timeline[0].pid).toBe("P1");
    expect(result.timeline[1].pid).toBe("P2");
    expect(result.timeline[2].pid).toBe("P3");
  });
});

describe("SRTF Scheduling", () => {
  it("should show preemption with exact timeline verification", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 8 },
      { pid: "P2", arrivalTime: 1, burstTime: 4 },
      { pid: "P3", arrivalTime: 2, burstTime: 2 },
    ];

    const result = srtf(processes);

    // P1 runs [0,1], P2 preempts (4<7), P2 runs [1,2], P3 preempts (2<3),
    // P3 runs [2,4], P2 resumes [4,7], P1 resumes [7,14]
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 1 },
      { pid: "P2", start: 1, end: 2 },
      { pid: "P3", start: 2, end: 4 },
      { pid: "P2", start: 4, end: 7 },
      { pid: "P1", start: 7, end: 14 },
    ]);
  });

  it("should NOT fragment when arrival does not preempt (no unnecessary slicing)", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 5 },
      { pid: "P2", arrivalTime: 1, burstTime: 3 },
      { pid: "P3", arrivalTime: 2, burstTime: 2 },
    ];

    const result = srtf(processes);

    // P1[0,1], P2 preempts (3<4). At t=2: P3 arrives (rem=2), P2 rem=2 — tied, P2<P3 by PID → no preempt.
    // P2 runs continuously [1,4], P3[4,6], P1[6,10]
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 1 },
      { pid: "P2", start: 1, end: 4 },
      { pid: "P3", start: 4, end: 6 },
      { pid: "P1", start: 6, end: 10 },
    ]);

    // Verify total work
    const totalTime = result.timeline.reduce((sum, slice) => sum + (slice.end - slice.start), 0);
    expect(totalTime).toBe(5 + 3 + 2);
  });

  it("should handle single process (no preemption needed)", () => {
    const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: 5 }];

    const result = srtf(processes);

    expect(result.timeline).toEqual([{ pid: "P1", start: 0, end: 5 }]);
    expect(result.processResults[0].waitingTime).toBe(0);
  });
});

describe("Round Robin Scheduling", () => {
  it("should show context switches with quantum=2", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 5 },
      { pid: "P2", arrivalTime: 0, burstTime: 5 },
      { pid: "P3", arrivalTime: 0, burstTime: 3 },
    ];

    const result = roundRobin(processes, { quantum: 2 });

    // Verify we have multiple context switches
    expect(result.timeline.length).toBeGreaterThan(processes.length);
    
    // Verify total work is correct
    const totalTime = result.timeline.reduce((sum, slice) => {
      if (slice.pid !== "idle") {
        return sum + (slice.end - slice.start);
      }
      return sum;
    }, 0);
    expect(totalTime).toBe(5 + 5 + 3);
  });

  it("should handle process with same process multiple times (context switches)", () => {
    // Two processes where one finishes early, then other should run to completion
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 5 },
      { pid: "P2", arrivalTime: 0, burstTime: 2 },
    ];

    const result = roundRobin(processes, { quantum: 2 });

    // P2 finishes after 2 time units, then P1 gets rest without further context switches
    // Timeline should be: P1(0-2), P2(2-4), P1(4-7) - no fragmentation for P1's remainder
    const p1Slices = result.timeline.filter((s) => s.pid === "P1");
    const p2SlicesEnd = Math.max(...result.timeline.filter((s) => s.pid === "P2").map((s) => s.end));

    // After P2 finishes, verify P1 has only one continuous slice for remaining work
    const p1SlicessAfterP2 = p1Slices.filter((s) => s.start >= p2SlicesEnd);
    expect(p1SlicessAfterP2.length).toBe(1);
  });

  it("should NOT fragment when process is alone but future arrival exists (regression test)", () => {
    // Regression: P1 (arrival 0, burst 10), P2 (arrival 20, burst 1), quantum=3
    // P1 should NOT produce four separate slices (0-3, 3-6, 6-9, 9-10)
    // Instead: P1 runs continuously (0-10), then P2 (20-21)
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 10 },
      { pid: "P2", arrivalTime: 20, burstTime: 1 },
    ];

    const result = roundRobin(processes, { quantum: 3 });

    // P1 should have exactly ONE timeline slice (no fragmentation while waiting for P2)
    const p1Slices = result.timeline.filter((s) => s.pid === "P1");
    expect(p1Slices.length).toBe(1);
    expect(p1Slices[0]).toEqual({ pid: "P1", start: 0, end: 10 });

    // P2 should run after P1 completes
    const p2Slices = result.timeline.filter((s) => s.pid === "P2");
    expect(p2Slices.length).toBe(1);
    expect(p2Slices[0]).toEqual({ pid: "P2", start: 20, end: 21 });
  });

  it("should respect arrival times", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 3 },
      { pid: "P2", arrivalTime: 5, burstTime: 3 },
    ];

    const result = roundRobin(processes, { quantum: 2 });

    // P1 is alone in queue and P2 arrives at 5
    // P1 runs from 0 until P2 arrives (0-3, all its burst since next arrival is at 5)
    // Then P1 gone, idle 3-5, P2 arrives at 5 and runs 5-8
    expect(result.timeline[0]).toEqual({ pid: "P1", start: 0, end: 3 });
    expect(result.timeline[1]).toEqual({ pid: "P2", start: 5, end: 8 });
  });

  it("should handle unsorted input (processes not ordered by arrival time)", () => {
    const processes: Process[] = [
      { pid: "P2", arrivalTime: 5, burstTime: 3 },
      { pid: "P1", arrivalTime: 0, burstTime: 3 },
    ];

    const result = roundRobin(processes, { quantum: 2 });

    // Same result as sorted input: P1(0-3), P2(5-8)
    expect(result.timeline[0]).toEqual({ pid: "P1", start: 0, end: 3 });
    expect(result.timeline[1]).toEqual({ pid: "P2", start: 5, end: 8 });
  });

  it("should work correctly with timeQuantum = 1", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 3 },
      { pid: "P2", arrivalTime: 0, burstTime: 2 },
    ];

    const result = roundRobin(processes, { quantum: 1 });

    // Q=1: P1(0-1), P2(1-2), P1(2-3), P2(3-4), P1(4-5)
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 1 },
      { pid: "P2", start: 1, end: 2 },
      { pid: "P1", start: 2, end: 3 },
      { pid: "P2", start: 3, end: 4 },
      { pid: "P1", start: 4, end: 5 },
    ]);
  });

  it("should handle empty process list", () => {
    const result = roundRobin([], { quantum: 2 });

    expect(result.timeline).toEqual([]);
    expect(result.processResults).toEqual([]);
  });
});

describe("Priority Scheduling", () => {
  it("should demonstrate non-preemptive priority scheduling", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 10, priority: 3 },
      { pid: "P2", arrivalTime: 1, burstTime: 3, priority: 1 },
      { pid: "P3", arrivalTime: 2, burstTime: 2, priority: 2 },
    ];

    const result = priorityScheduling(processes, { preemptive: false });

    // P1 starts first (no competitors), P2 arrives but has lower priority than P1 initially
    // After P1 completes: P3 (priority 2) then P2 (priority 1)
    expect(result.timeline[0].pid).toBe("P1");
    expect(result.timeline[0].end).toBe(10);
  });

  it("should demonstrate preemptive priority scheduling with exact timeline", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 10, priority: 3 },
      { pid: "P2", arrivalTime: 1, burstTime: 3, priority: 1 },
      { pid: "P3", arrivalTime: 2, burstTime: 2, priority: 2 },
    ];

    const result = priorityScheduling(processes, { preemptive: true });

    // P1[0,1], P2 preempts (pri 1 < 3). P3 arrives at 2 (pri 2 > 1, does NOT preempt P2).
    // P2 runs continuously [1,4], then P3[4,6], then P1[6,15].
    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 1 },
      { pid: "P2", start: 1, end: 4 },
      { pid: "P3", start: 4, end: 6 },
      { pid: "P1", start: 6, end: 15 },
    ]);
  });

  it("should handle priority=undefined (default low priority)", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 5 },
      { pid: "P2", arrivalTime: 0, burstTime: 3, priority: 1 },
    ];

    const result = priorityScheduling(processes, { preemptive: false });

    // P2 has priority 1 (higher), P1 gets default high number (lower priority)
    expect(result.timeline[0].pid).toBe("P2");
  });

  it("should handle priority=0 (highest possible priority)", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 5, priority: 1 },
      { pid: "P2", arrivalTime: 0, burstTime: 3, priority: 0 },
    ];

    const result = priorityScheduling(processes, { preemptive: false });

    // P2 has priority 0 (highest), should run first
    expect(result.timeline[0].pid).toBe("P2");
    expect(result.timeline[1].pid).toBe("P1");
  });

  it("should handle explicit priority > 999 correctly (not capped by default)", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 3 },           // undefined → MAX_SAFE_INTEGER
      { pid: "P2", arrivalTime: 0, burstTime: 3, priority: 1000 },
    ];

    const result = priorityScheduling(processes, { preemptive: false });

    // P2 (priority 1000) should run before P1 (default MAX_SAFE_INTEGER)
    expect(result.timeline[0].pid).toBe("P2");
    expect(result.timeline[1].pid).toBe("P1");
  });

  it("should break ties by PID order (preemptive)", () => {
    const processes: Process[] = [
      { pid: "P2", arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: "P1", arrivalTime: 0, burstTime: 1, priority: 1 },
    ];

    const result = priorityScheduling(processes, { preemptive: true });

    // Same priority and arrival, should use PID order
    expect(result.timeline[0].pid).toBe("P1");
  });
});

describe("Edge Cases", () => {
  it("should handle processes with identical arrival times", () => {
    const processes: Process[] = [
      { pid: "P2", arrivalTime: 0, burstTime: 3 },
      { pid: "P1", arrivalTime: 0, burstTime: 3 },
    ];

    const result = fifo(processes);

    // Should maintain PID order
    expect(result.timeline[0].pid).toBe("P1");
    expect(result.timeline[1].pid).toBe("P2");
  });

  it("should handle process with zero-wait scenario", () => {
    const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: 5 }];

    const result = fifo(processes);

    expect(result.processResults[0].waitingTime).toBe(0);
    expect(result.processResults[0].responseTime).toBe(0);
  });

  it("should handle large gap between processes", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 5 },
      { pid: "P2", arrivalTime: 100, burstTime: 3 },
    ];

    const result = fifo(processes);

    expect(result.timeline).toEqual([
      { pid: "P1", start: 0, end: 5 },
      { pid: "P2", start: 100, end: 103 },
    ]);
  });

  it("should maintain determinism (same input produces same output)", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 8 },
      { pid: "P2", arrivalTime: 1, burstTime: 4 },
      { pid: "P3", arrivalTime: 2, burstTime: 2 },
    ];

    const result1 = srtf(processes);
    const result2 = srtf(processes);

    expect(result1.timeline).toEqual(result2.timeline);
    expect(result1.processResults).toEqual(result2.processResults);
    expect(result1.averageWaitingTime).toBe(result2.averageWaitingTime);
  });
});

describe("Comparisons", () => {
  it("should show different results for FIFO vs SJF", () => {
    // Use an example where FIFO and SJF produce different orderings
    // P1 runs first in both (only process at t=0). After P1 finishes at t=4:
    // FIFO picks P2 (arrived first), SJF picks P3 (shortest burst)
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 4 },
      { pid: "P2", arrivalTime: 1, burstTime: 2 },
      { pid: "P3", arrivalTime: 2, burstTime: 1 },
    ];

    const fifoResult = fifo(processes);
    const sjfResult = sjf(processes);

    // FIFO: P1(0-4), P2(4-6), P3(6-7) — avgWait = (0 + 3 + 4) / 3 = 7/3
    expect(fifoResult.timeline).toEqual([
      { pid: "P1", start: 0, end: 4 },
      { pid: "P2", start: 4, end: 6 },
      { pid: "P3", start: 6, end: 7 },
    ]);
    expect(fifoResult.averageWaitingTime).toBeCloseTo(7 / 3);

    // SJF: P1(0-4), P3(4-5), P2(5-7) — avgWait = (0 + 4 + 2) / 3 = 2
    expect(sjfResult.timeline).toEqual([
      { pid: "P1", start: 0, end: 4 },
      { pid: "P3", start: 4, end: 5 },
      { pid: "P2", start: 5, end: 7 },
    ]);
    expect(sjfResult.averageWaitingTime).toBeCloseTo(2);

    // SJF should have lower or equal average waiting time
    expect(sjfResult.averageWaitingTime).toBeLessThanOrEqual(fifoResult.averageWaitingTime);
  });

  it("should show preemptive vs non-preemptive difference for priority", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 10, priority: 2 },
      { pid: "P2", arrivalTime: 5, burstTime: 5, priority: 1 },
    ];

    const nonPreemptive = priorityScheduling(processes, { preemptive: false });
    const preemptive = priorityScheduling(processes, { preemptive: true });

    // Should differ in timeline length (preemptive should have more slices)
    expect(preemptive.timeline.length).toBeGreaterThan(nonPreemptive.timeline.length);
  });
});

describe("All-Equal Processes", () => {
  it("should handle processes with identical burst times, arrival times, and priorities", () => {
    const processes: Process[] = [
      { pid: "P1", arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: "P2", arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: "P3", arrivalTime: 0, burstTime: 3, priority: 1 },
    ];

    // SJF: all equal burst, tie-break by PID
    const sjfResult = sjf(processes);
    expect(sjfResult.timeline[0].pid).toBe("P1");
    expect(sjfResult.timeline[1].pid).toBe("P2");
    expect(sjfResult.timeline[2].pid).toBe("P3");

    // Priority non-preemptive: all equal priority, tie-break by PID
    const priResult = priorityScheduling(processes, { preemptive: false });
    expect(priResult.timeline[0].pid).toBe("P1");
    expect(priResult.timeline[1].pid).toBe("P2");
    expect(priResult.timeline[2].pid).toBe("P3");

    // All should have same turnaround pattern
    expect(sjfResult.averageTurnaroundTime).toBeCloseTo(priResult.averageTurnaroundTime);
  });
});

describe("Validation Tests", () => {
  describe("Quantum Validation", () => {
    it("should throw error for quantum <= 0", () => {
      const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: 5 }];
      expect(() => roundRobin(processes, { quantum: 0 })).toThrow(
        "Invalid quantum: must be a positive integer, got 0"
      );
      expect(() => roundRobin(processes, { quantum: -1 })).toThrow();
    });

    it("should throw error for non-integer quantum", () => {
      const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: 5 }];
      expect(() => roundRobin(processes, { quantum: 2.5 })).toThrow(
        "Invalid quantum: must be a positive integer, got 2.5"
      );
    });
  });

  describe("Round Robin Fragmentation Fix", () => {
    it("should run remaining process to completion when queue is empty", () => {
      const processes: Process[] = [
        { pid: "P1", arrivalTime: 0, burstTime: 3 },
        { pid: "P2", arrivalTime: 1, burstTime: 2 },
      ];

      const result = roundRobin(processes, { quantum: 2 });

      // P1 should get one final slice for remaining burst (not fragmented)
      // Find all slices for P1
      const p1Slices = result.timeline.filter((s) => s.pid === "P1");
      
      // After P2 finishes, P1's remaining work should be in ONE continuous slice
      const p1SlicesAfterP2 = p1Slices.filter((s) => {
        const p2LastTime = Math.max(...result.timeline.filter((x) => x.pid === "P2").map((x) => x.end));
        return s.start >= p2LastTime;
      });

      // Should have at most 1 P1 slice after P2 finishes (not fragmented)
      if (p1SlicesAfterP2.length > 0) {
        expect(p1SlicesAfterP2.length).toBe(1);
      }
    });
  });

  describe("Duplicate PID Detection", () => {
    it("should throw error for duplicate PIDs in FIFO", () => {
      const processes: Process[] = [
        { pid: "P1", arrivalTime: 0, burstTime: 5 },
        { pid: "P1", arrivalTime: 1, burstTime: 3 },
      ];
      expect(() => fifo(processes)).toThrow("Duplicate process ID found: P1");
    });

    it("should throw error for duplicate PIDs in SJF", () => {
      const processes: Process[] = [
        { pid: "P2", arrivalTime: 0, burstTime: 5 },
        { pid: "P2", arrivalTime: 1, burstTime: 3 },
      ];
      expect(() => sjf(processes)).toThrow("Duplicate process ID found: P2");
    });

    it("should throw error for duplicate PIDs in SRTF", () => {
      const processes: Process[] = [
        { pid: "P3", arrivalTime: 0, burstTime: 5 },
        { pid: "P3", arrivalTime: 1, burstTime: 3 },
      ];
      expect(() => srtf(processes)).toThrow("Duplicate process ID found: P3");
    });

    it("should throw error for duplicate PIDs in Round Robin", () => {
      const processes: Process[] = [
        { pid: "P4", arrivalTime: 0, burstTime: 5 },
        { pid: "P4", arrivalTime: 1, burstTime: 3 },
      ];
      expect(() => roundRobin(processes, { quantum: 2 })).toThrow("Duplicate process ID found: P4");
    });

    it("should throw error for duplicate PIDs in Priority Scheduling", () => {
      const processes: Process[] = [
        { pid: "P5", arrivalTime: 0, burstTime: 5, priority: 1 },
        { pid: "P5", arrivalTime: 1, burstTime: 3, priority: 2 },
      ];
      expect(() => priorityScheduling(processes, { preemptive: false })).toThrow(
        "Duplicate process ID found: P5"
      );
    });
  });

  describe("Invalid Process Values", () => {
    it("should throw error for negative arrival time", () => {
      const processes: Process[] = [{ pid: "P1", arrivalTime: -1, burstTime: 5 }];
      expect(() => fifo(processes)).toThrow("has negative arrivalTime");
    });

    it("should throw error for zero burst time", () => {
      const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: 0 }];
      expect(() => fifo(processes)).toThrow("has invalid burstTime");
    });

    it("should throw error for negative burst time", () => {
      const processes: Process[] = [{ pid: "P1", arrivalTime: 0, burstTime: -5 }];
      expect(() => sjf(processes)).toThrow("has invalid burstTime");
    });

    it("should validate in all scheduling algorithms", () => {
      const invalidProcess: Process = { pid: "P1", arrivalTime: 0, burstTime: 0 };
      
      expect(() => fifo([invalidProcess])).toThrow();
      expect(() => sjf([invalidProcess])).toThrow();
      expect(() => srtf([invalidProcess])).toThrow();
      expect(() => roundRobin([invalidProcess], { quantum: 2 })).toThrow();
      expect(() => priorityScheduling([invalidProcess], { preemptive: false })).toThrow();
    });
  });
});
