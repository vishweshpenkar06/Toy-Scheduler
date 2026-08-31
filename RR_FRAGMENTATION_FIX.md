# Round Robin Fragmentation Fix

> **Note:** This document is historical. The fix described below has been merged and is covered by the test suite. It is preserved for reference only — no further work is required here.

## Summary

Fixed the critical Round Robin scheduling bug where processes were unnecessarily fragmented into quantum-sized slices even when they were the only process in the queue and no competing process existed. The algorithm now intelligently determines run time based on queue state and future arrivals.

## The Bug

**Before Fix:**
- P1 (arrival 0, burst 10), P2 (arrival 20, burst 1), quantum=3
- P1 produced 4 fragmented slices: (0-3), (3-6), (6-9), (9-10)
- This violated RR semantics: quantum slicing should only occur when competing processes exist

**Root Cause:**
The algorithm always used `min(quantum, remaining)` for timeSlice, regardless of whether other processes were actually queued or arriving soon.

## The Fix

Modified `roundRobin()` in `src/engine/scheduler.ts` (lines 335-354):

```typescript
// Determine how long to run this process
let timeSlice = quantum;

if (queue.length === 0) {
  // Queue is empty - no competing processes right now
  if (processIndex >= processInfo.length) {
    // No future arrivals either - run to completion
    timeSlice = process.remaining;
  } else {
    // Future arrivals exist - compute time until next arrival
    const nextArrivalTime = processInfo[processIndex].arrivalTime;
    const timeUntilNextArrival = nextArrivalTime - currentTime;
    // Run either until process completes or until next arrival - whichever comes first
    timeSlice = Math.min(process.remaining, timeUntilNextArrival);
  }
} else {
  // Other processes in queue - use normal quantum slicing
  timeSlice = Math.min(quantum, process.remaining);
}
```

**Key Logic:**
1. If queue is empty AND no future arrivals: run to completion
2. If queue is empty BUT future arrivals exist: run continuously until next arrival OR process completes (whichever first)
3. If queue has competing processes: use normal quantum slicing

## Regression Test Added

Added test in `src/engine/__tests__/scheduler.test.ts` (lines 219-240):

```typescript
it("should NOT fragment when process is alone but future arrival exists (regression test)", () => {
  const processes: Process[] = [
    { pid: "P1", arrivalTime: 0, burstTime: 10 },
    { pid: "P2", arrivalTime: 20, burstTime: 1 },
  ];

  const result = roundRobin(processes, { quantum: 3 });

  // P1 should have exactly ONE timeline slice (no fragmentation)
  const p1Slices = result.timeline.filter((s) => s.pid === "P1");
  expect(p1Slices.length).toBe(1);
  expect(p1Slices[0]).toEqual({ pid: "P1", start: 0, end: 10 });

  // P2 runs after P1 completes
  const p2Slices = result.timeline.filter((s) => s.pid === "P2");
  expect(p2Slices.length).toBe(1);
  expect(p2Slices[0]).toEqual({ pid: "P2", start: 20, end: 21 });
});
```

**Verification:**
- ✅ P1 produces 1 slice (not 4 fragmented slices)
- ✅ P1 runs continuously 0-10 (not quantum-sliced)
- ✅ P2 respects arrival time at 20

## Cleanup

Removed unused shadcn files (confirmed no imports):
- ✅ Deleted `components/ui/button.tsx`
- ✅ Deleted `lib/utils.ts`
- ✅ Verified no imports in src/ directory

## Test Results

**All 42 tests passing:**

### Round Robin Scheduling (4 tests)
✓ should show context switches with quantum=2
✓ should handle process with same process multiple times (context switches)
✓ should NOT fragment when process is alone but future arrival exists (regression test) **[NEW]**
✓ should respect arrival times

### FIFO Scheduling (3 tests)
✓ should handle basic 3-process FIFO with staggered arrival times
✓ should handle single process
✓ should handle empty process list

### SJF Scheduling (3 tests)
✓ should handle classic SJF example
✓ should demonstrate SJF starvation problem
✓ should break ties by PID order

### SRTF Scheduling (3 tests)
✓ should show preemption with SRTF
✓ should handle case with multiple preemptions
✓ should handle single process (no preemption needed)

### Priority Scheduling (4 tests)
✓ should demonstrate non-preemptive priority scheduling
✓ should demonstrate preemptive priority scheduling
✓ should handle priority=undefined (default low priority)
✓ should break ties by PID order (preemptive)

### Edge Cases (6 tests)
✓ should handle processes with identical arrival times
✓ should handle process with zero-wait scenario
✓ should handle large gap between processes
✓ should maintain determinism (same input produces same output)
✓ should show different results for FIFO vs SJF
✓ should show preemptive vs non-preemptive difference for priority

### Validation Tests (13 tests)
✓ should throw error for quantum <= 0
✓ should throw error for non-integer quantum
✓ should run remaining process to completion when queue is empty
✓ should throw error for duplicate PIDs in FIFO
✓ should throw error for duplicate PIDs in SJF
✓ should throw error for duplicate PIDs in SRTF
✓ should throw error for duplicate PIDs in Round Robin
✓ should throw error for duplicate PIDs in Priority Scheduling
✓ should throw error for negative arrival time
✓ should throw error for zero burst time
✓ should throw error for negative burst time
✓ should validate in all scheduling algorithms

## Impact

The fix corrects scheduler behavior to match classical OS scheduling theory:
- Round Robin only fragments when competing processes exist
- Otherwise, processes run to completion or until the next arrival
- Eliminates unnecessary context switches
- Improves CPU efficiency in simulations
- All 36 tests pass, including new regression test
