import {
  Process,
  ProcessResult,
  SimulationResult,
  TimelineSlice,
  RoundRobinOptions,
  PrioritySchedulingOptions,
  AlgorithmType,
} from "../types";

/**
 * Validate a single process entry: returns an error message or null if valid.
 * Mirrors `validateProcesses` so UI and engine enforce identical rules.
 */
export function validateProcessInput(p: Process): string | null {
  if (!p.pid || !p.pid.trim()) {
    return 'Process ID is required.';
  }
  if (!Number.isFinite(p.arrivalTime) || !Number.isInteger(p.arrivalTime)) {
    return `Process ${p.pid} has invalid arrivalTime: ${p.arrivalTime}`;
  }
  if (p.arrivalTime < 0) {
    return `Process ${p.pid} has negative arrivalTime: ${p.arrivalTime}`;
  }
  if (!Number.isFinite(p.burstTime) || !Number.isInteger(p.burstTime)) {
    return `Process ${p.pid} has invalid burstTime: ${p.burstTime}`;
  }
  if (p.burstTime <= 0) {
    return `Process ${p.pid} has invalid burstTime: ${p.burstTime}`;
  }
  return null;
}

/**
 * Validate process array: check for duplicates and invalid values
 */
function validateProcesses(processes: Process[]): void {
  const pids = new Set<string>();

  processes.forEach((p) => {
    // Check for duplicates
    if (pids.has(p.pid)) {
      throw new Error(`Duplicate process ID found: ${p.pid}`);
    }
    pids.add(p.pid);

    // Delegate value checks to the shared single-process validator
    const message = validateProcessInput(p);
    if (message) {
      throw new Error(message);
    }
  });
}

/**
 * Helper: Calculate metrics for completed processes
 */
function calculateMetrics(
  processes: Process[],
  timeline: TimelineSlice[]
): { results: ProcessResult[]; avgWait: number; avgTurnaround: number; avgResponse: number } {
  const resultMap = new Map<string, ProcessResult>();

  // Initialize result map for each process
  processes.forEach((p) => {
    resultMap.set(p.pid, {
      pid: p.pid,
      waitingTime: 0,
      turnaroundTime: 0,
      responseTime: 0,
      completionTime: 0,
    });
  });

  // Calculate completion time, response time for each process
  const firstExecution = new Map<string, number>();
  timeline.forEach((slice) => {
    if (slice.pid !== "idle") {
      const result = resultMap.get(slice.pid)!;
      result.completionTime = Math.max(result.completionTime, slice.end);

      if (!firstExecution.has(slice.pid)) {
        firstExecution.set(slice.pid, slice.start);
      }
    }
  });

  // Calculate response time and turnaround time
  processes.forEach((p) => {
    const result = resultMap.get(p.pid)!;
    const firstExec = firstExecution.get(p.pid) ?? 0;
    result.responseTime = Math.max(0, firstExec - p.arrivalTime);
    result.turnaroundTime = result.completionTime - p.arrivalTime;
  });

  // Calculate waiting time
  processes.forEach((p) => {
    const result = resultMap.get(p.pid)!;
    result.waitingTime = result.turnaroundTime - p.burstTime;
  });

  const results = Array.from(resultMap.values());
  const avgWait = results.reduce((sum, r) => sum + r.waitingTime, 0) / results.length;
  const avgTurnaround = results.reduce((sum, r) => sum + r.turnaroundTime, 0) / results.length;
  const avgResponse = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  return { results, avgWait, avgTurnaround, avgResponse };
}

/**
 * FIFO: First Come First Served (non-preemptive)
 */
export function fifo(processes: Process[]): SimulationResult {
  validateProcesses(processes);
  
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      averageResponseTime: 0,
    };
  }

  const timeline: TimelineSlice[] = [];
  const sorted = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime || a.pid.localeCompare(b.pid));
  const queue: Process[] = [];
  let currentTime = 0;
  let processIndex = 0;

  while (processIndex < sorted.length || queue.length > 0) {
    // Add all processes that have arrived
    while (processIndex < sorted.length && sorted[processIndex].arrivalTime <= currentTime) {
      queue.push(sorted[processIndex]);
      processIndex++;
    }

    if (queue.length === 0) {
      // No process ready, jump to next arrival
      if (processIndex < sorted.length) {
        currentTime = sorted[processIndex].arrivalTime;
      }
      continue;
    }

    // Process the first in queue
    const process = queue.shift()!;
    timeline.push({
      pid: process.pid,
      start: currentTime,
      end: currentTime + process.burstTime,
    });
    currentTime += process.burstTime;
  }

  const { results, avgWait, avgTurnaround, avgResponse } = calculateMetrics(processes, timeline);

  return {
    timeline,
    processResults: results,
    averageWaitingTime: avgWait,
    averageTurnaroundTime: avgTurnaround,
    averageResponseTime: avgResponse,
  };
}

/**
 * SJF: Shortest Job First (non-preemptive)
 */
export function sjf(processes: Process[]): SimulationResult {
  validateProcesses(processes);
  
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      averageResponseTime: 0,
    };
  }

  const timeline: TimelineSlice[] = [];
  const remaining = new Set(processes.map((p) => p.pid));
  let currentTime = 0;

  while (remaining.size > 0) {
    // Find all processes that have arrived by currentTime
    const available = processes.filter(
      (p) => p.arrivalTime <= currentTime && remaining.has(p.pid)
    );

    if (available.length === 0) {
      // No process ready, jump to next arrival
      const nextArrival = Math.min(
        ...processes.filter((p) => remaining.has(p.pid)).map((p) => p.arrivalTime)
      );
      currentTime = nextArrival;
      continue;
    }

    // Pick the process with shortest burst time, break ties by PID
    const process = available.sort(
      (a, b) => a.burstTime - b.burstTime || a.pid.localeCompare(b.pid)
    )[0];

    timeline.push({
      pid: process.pid,
      start: currentTime,
      end: currentTime + process.burstTime,
    });
    currentTime += process.burstTime;
    remaining.delete(process.pid);
  }

  const { results, avgWait, avgTurnaround, avgResponse } = calculateMetrics(processes, timeline);

  return {
    timeline,
    processResults: results,
    averageWaitingTime: avgWait,
    averageTurnaroundTime: avgTurnaround,
    averageResponseTime: avgResponse,
  };
}

/**
 * SRTF: Shortest Remaining Time First (preemptive version of SJF)
 */
export function srtf(processes: Process[]): SimulationResult {
  validateProcesses(processes);
  
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      averageResponseTime: 0,
    };
  }

  const timeline: TimelineSlice[] = [];
  const processInfo = processes.map((p) => ({
    ...p,
    remaining: p.burstTime,
  }));
  const remaining = new Set(processes.map((p) => p.pid));
  let currentTime = 0;

  while (remaining.size > 0) {
    // Find all processes that have arrived by currentTime
    const available = processInfo.filter(
      (p) => p.arrivalTime <= currentTime && remaining.has(p.pid)
    );

    if (available.length === 0) {
      // No process ready, jump to next arrival
      const nextArrival = Math.min(
        ...processInfo.filter((p) => remaining.has(p.pid)).map((p) => p.arrivalTime)
      );
      currentTime = nextArrival;
      continue;
    }

    // Pick process with shortest remaining time, break ties by PID
    const process = available.sort(
      (a, b) => a.remaining - b.remaining || a.pid.localeCompare(b.pid)
    )[0];

    // Run until next preempting event or completion
    let nextEventTime = currentTime + process.remaining;
    // Only preempt if an arriving process has strictly shorter remaining time
    const futureArrivals = processInfo
      .filter((p) => p.arrivalTime > currentTime && p.arrivalTime < nextEventTime && remaining.has(p.pid))
      .sort((a, b) => a.arrivalTime - b.arrivalTime);
    for (const arrival of futureArrivals) {
      const currentRemainingAtArrival = process.remaining - (arrival.arrivalTime - currentTime);
      if (
        arrival.remaining < currentRemainingAtArrival ||
        (arrival.remaining === currentRemainingAtArrival && arrival.pid.localeCompare(process.pid) < 0)
      ) {
        nextEventTime = arrival.arrivalTime;
        break;
      }
    }

    const timeSlice = nextEventTime - currentTime;
    process.remaining -= timeSlice;

    timeline.push({
      pid: process.pid,
      start: currentTime,
      end: nextEventTime,
    });

    if (process.remaining <= 0) {
      remaining.delete(process.pid);
    }

    currentTime = nextEventTime;
  }

  const { results, avgWait, avgTurnaround, avgResponse } = calculateMetrics(processes, timeline);

  return {
    timeline,
    processResults: results,
    averageWaitingTime: avgWait,
    averageTurnaroundTime: avgTurnaround,
    averageResponseTime: avgResponse,
  };
}

/**
 * Round Robin scheduling (preemptive with fixed quantum)
 */
export function roundRobin(processes: Process[], options: RoundRobinOptions): SimulationResult {
  validateProcesses(processes);
  
  const { quantum } = options;
  
  // Validate quantum
  if (quantum <= 0 || !Number.isInteger(quantum)) {
    throw new Error(`Invalid quantum: must be a positive integer, got ${quantum}`);
  }
  
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      averageResponseTime: 0,
    };
  }

  const timeline: TimelineSlice[] = [];
  const processInfo = processes.map((p) => ({
    ...p,
    remaining: p.burstTime,
  }));
  // Sort by arrivalTime so index-based enqueuing works on unsorted input
  processInfo.sort((a, b) => a.arrivalTime - b.arrivalTime || a.pid.localeCompare(b.pid));
  const queue: typeof processInfo = [];
  const remaining = new Set(processes.map((p) => p.pid));
  let currentTime = 0;
  let processIndex = 0;

  while (remaining.size > 0 || queue.length > 0) {
    // Add all processes that have arrived by currentTime
    while (processIndex < processInfo.length && processInfo[processIndex].arrivalTime <= currentTime) {
      queue.push(processInfo[processIndex]);
      processIndex++;
    }

    if (queue.length === 0) {
      if (processIndex < processInfo.length) {
        currentTime = processInfo[processIndex].arrivalTime;
      }
      continue;
    }

    // Dequeue first process
    const process = queue.shift()!;
    
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

    timeline.push({
      pid: process.pid,
      start: currentTime,
      end: currentTime + timeSlice,
    });

    currentTime += timeSlice;
    process.remaining -= timeSlice;

    // Add newly arrived processes
    while (processIndex < processInfo.length && processInfo[processIndex].arrivalTime <= currentTime) {
      queue.push(processInfo[processIndex]);
      processIndex++;
    }

    if (process.remaining > 0) {
      // Put back in queue if not done
      queue.push(process);
    } else {
      remaining.delete(process.pid);
    }
  }

  const { results, avgWait, avgTurnaround, avgResponse } = calculateMetrics(processes, timeline);

  return {
    timeline,
    processResults: results,
    averageWaitingTime: avgWait,
    averageTurnaroundTime: avgTurnaround,
    averageResponseTime: avgResponse,
  };
}

/**
 * Priority Scheduling (both preemptive and non-preemptive)
 */
export function priorityScheduling(
  processes: Process[],
  options: PrioritySchedulingOptions
): SimulationResult {
  validateProcesses(processes);
  
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      averageResponseTime: 0,
    };
  }

  const { preemptive } = options;
  const timeline: TimelineSlice[] = [];
  const processInfo = processes.map((p) => ({
    ...p,
    priority: p.priority ?? Number.MAX_SAFE_INTEGER,
    remaining: p.burstTime,
  }));
  const remaining = new Set(processes.map((p) => p.pid));
  let currentTime = 0;

  while (remaining.size > 0) {
    // Find all processes that have arrived by currentTime
    const available = processInfo.filter(
      (p) => p.arrivalTime <= currentTime && remaining.has(p.pid)
    );

    if (available.length === 0) {
      // No process ready, jump to next arrival
      const nextArrival = Math.min(
        ...processInfo.filter((p) => remaining.has(p.pid)).map((p) => p.arrivalTime)
      );
      currentTime = nextArrival;
      continue;
    }

    // Pick process with highest priority (lowest number), break ties by PID
    const process = available.sort(
      (a, b) => a.priority - b.priority || a.pid.localeCompare(b.pid)
    )[0];

    if (preemptive) {
      // Preemptive: run until a higher-priority process arrives or completion
      let nextEventTime = currentTime + process.remaining;
      // Only preempt if an arriving process has strictly higher priority (lower number)
      const preemptingArrivals = processInfo.filter(
        (p) =>
          p.arrivalTime > currentTime &&
          p.arrivalTime < nextEventTime &&
          remaining.has(p.pid) &&
          (p.priority < process.priority ||
           (p.priority === process.priority && p.pid.localeCompare(process.pid) < 0))
      );
      if (preemptingArrivals.length > 0) {
        nextEventTime = Math.min(...preemptingArrivals.map((p) => p.arrivalTime));
      }

      const timeSlice = nextEventTime - currentTime;
      process.remaining -= timeSlice;

      timeline.push({
        pid: process.pid,
        start: currentTime,
        end: nextEventTime,
      });

      if (process.remaining <= 0) {
        remaining.delete(process.pid);
      }

      currentTime = nextEventTime;
    } else {
      // Non-preemptive: run to completion
      timeline.push({
        pid: process.pid,
        start: currentTime,
        end: currentTime + process.remaining,
      });
      currentTime += process.remaining;
      remaining.delete(process.pid);
    }
  }

  const { results, avgWait, avgTurnaround, avgResponse } = calculateMetrics(processes, timeline);

  return {
    timeline,
    processResults: results,
    averageWaitingTime: avgWait,
    averageTurnaroundTime: avgTurnaround,
    averageResponseTime: avgResponse,
  };
}

/**
 * Uniform dispatcher: runs the given scheduling algorithm over a workload.
 * The default quantum is used for Round Robin when none is supplied.
 */
export function runAlgorithm(
  algorithm: AlgorithmType,
  processes: Process[],
  options?: { quantum?: number }
): SimulationResult {
  switch (algorithm) {
    case 'fifo':
      return fifo(processes);
    case 'sjf':
      return sjf(processes);
    case 'srtf':
      return srtf(processes);
    case 'roundRobin':
      return roundRobin(processes, { quantum: options?.quantum ?? 1 });
    case 'priorityNonPreemptive':
      return priorityScheduling(processes, { preemptive: false });
    case 'priorityPreemptive':
      return priorityScheduling(processes, { preemptive: true });
  }
}
