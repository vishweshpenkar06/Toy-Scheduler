import {
  Process,
  ProcessResult,
  SimulationResult,
  TimelineSlice,
  RoundRobinOptions,
  PrioritySchedulingOptions,
  PriorityAgingOptions,
  MultiLevelQueueOptions,
  MultiLevelFeedbackOptions,
  AlgorithmType,
} from "../types";

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

Helper: Calculate metrics for completed processes
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

FIFO: First Come First Served (non-preemptive)
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

SJF: Shortest Job First (non-preemptive)
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

SRTF: Shortest Remaining Time First (preemptive version of SJF)
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

Round Robin scheduling (preemptive with fixed quantum)
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

Priority Scheduling (both preemptive and non-preemptive)
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


export function priorityAgingScheduling(
  processes: Process[],
  options: PriorityAgingOptions
): SimulationResult {
  validateProcesses(processes);
  
  const { agingInterval, agingAmount } = options;
  
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
    effectivePriority: p.priority ?? Number.MAX_SAFE_INTEGER,
    remaining: p.burstTime,
    lastAgingCheck: 0,
  }));
  const remaining = new Set(processes.map((p) => p.pid));
  let currentTime = 0;

  while (remaining.size > 0) {
    // Apply aging to all waiting processes
    for (const p of processInfo) {
      if (remaining.has(p.pid) && p.arrivalTime <= currentTime) {
        const timeSinceLastCheck = currentTime - p.lastAgingCheck;
        if (timeSinceLastCheck >= agingInterval) {
          // Bump priority (lower number = higher priority)
          p.effectivePriority = Math.max(0, p.effectivePriority - Math.floor(timeSinceLastCheck / agingInterval) * agingAmount);
          p.lastAgingCheck = currentTime;
        }
      }
    }

    // Find all processes that have arrived
    const available = processInfo.filter(
      (p) => p.arrivalTime <= currentTime && remaining.has(p.pid)
    );

    if (available.length === 0) {
      const nextArrival = Math.min(
        ...processInfo.filter((p) => remaining.has(p.pid)).map((p) => p.arrivalTime)
      );
      // Fast-forward aging to next arrival
      currentTime = nextArrival;
      continue;
    }

    // Pick process with highest priority (lowest number), break ties by PID
    const process = available.sort(
      (a, b) => a.effectivePriority - b.effectivePriority || a.pid.localeCompare(b.pid)
    )[0];

    // Find the next event: either aging would promote someone else, or the process finishes
    let nextEventTime = currentTime + process.remaining;

    // Check if any waiting process could be promoted before this process finishes
    for (const p of processInfo) {
      if (p.pid !== process.pid && remaining.has(p.pid) && p.arrivalTime <= currentTime) {
        const nextAgingTime = p.lastAgingCheck + agingInterval;
        if (nextAgingTime > currentTime && nextAgingTime < nextEventTime) {
          nextEventTime = nextAgingTime;
        }
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


export function multiLevelQueueScheduling(
  processes: Process[],
  options: MultiLevelQueueOptions
): SimulationResult {
  validateProcesses(processes);
  
  const { queues } = options;
  
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

  const queueBuckets: Process[][] = queues.map(() => []);
  
  const assignProcess = (p: Process) => {
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      if (q.priorityRange) {
        const pri = p.priority ?? Number.MAX_SAFE_INTEGER;
        if (pri >= q.priorityRange.min && pri <= q.priorityRange.max) {
          queueBuckets[i].push(p);
          return;
        }
      } else {
        queueBuckets[i].push(p);
        return;
      }
    }
    queueBuckets[queues.length - 1].push(p);
  };

  const sortedByArrival = [...processes].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.pid.localeCompare(b.pid)
  );

  let processIndex = 0;

  while (remaining.size > 0) {
    while (processIndex < sortedByArrival.length && sortedByArrival[processIndex].arrivalTime <= currentTime) {
      assignProcess(sortedByArrival[processIndex]);
      processIndex++;
    }

    let selectedQueue = -1;
    for (let i = 0; i < queueBuckets.length; i++) {
      if (queueBuckets[i].length > 0) {
        selectedQueue = i;
        break;
      }
    }

    if (selectedQueue === -1) {
      if (processIndex < sortedByArrival.length) {
        currentTime = sortedByArrival[processIndex].arrivalTime;
      }
      continue;
    }

    const process = queueBuckets[selectedQueue].shift()!;
    
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


export function multiLevelFeedbackQueueScheduling(
  processes: Process[],
  options: MultiLevelFeedbackOptions
): SimulationResult {
  validateProcesses(processes);
  
  const { quantumPerLevel, agingPromotionInterval = 10, demotionThreshold = 2 } = options;
  
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      averageResponseTime: 0,
    };
  }

  const numLevels = quantumPerLevel.length;
  const timeline: TimelineSlice[] = [];
  const processInfo = processes.map((p) => ({
    ...p,
    remaining: p.burstTime,
    level: 0,
    lastServedTime: -p.arrivalTime,
    timesSliced: 0,
  }));
  const remaining = new Set(processes.map((p) => p.pid));
  const queues: (typeof processInfo[0])[][] = Array.from({ length: numLevels }, () => []);
  let currentTime = 0;
  let processIndex = 0;

  const sortedByArrival = [...processInfo].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.pid.localeCompare(b.pid)
  );

  while (remaining.size > 0) {
    // Add newly arrived processes to level 0
    while (processIndex < sortedByArrival.length && sortedByArrival[processIndex].arrivalTime <= currentTime) {
      const p = sortedByArrival[processIndex];
      p.level = 0;
      queues[0].push(p);
      processIndex++;
    }

    // Find the highest-priority non-empty queue
    let selectedLevel = -1;
    for (let i = 0; i < numLevels; i++) {
      if (queues[i].length > 0) {
        selectedLevel = i;
        break;
      }
    }

    if (selectedLevel === -1) {
      if (processIndex < sortedByArrival.length) {
        currentTime = sortedByArrival[processIndex].arrivalTime;
      }
      continue;
    }

    // Aging: promote processes that have waited too long
    for (let i = numLevels - 1; i > 0; i--) {
      for (let j = queues[i].length - 1; j >= 0; j--) {
        const p = queues[i][j];
        if (currentTime - p.lastServedTime >= agingPromotionInterval) {
          queues[i].splice(j, 1);
          p.level = i - 1;
          queues[i - 1].push(p);
        }
      }
    }

    // Re-find highest non-empty level after aging
    selectedLevel = -1;
    for (let i = 0; i < numLevels; i++) {
      if (queues[i].length > 0) {
        selectedLevel = i;
        break;
      }
    }

    if (selectedLevel === -1) {
      if (processIndex < sortedByArrival.length) {
        currentTime = sortedByArrival[processIndex].arrivalTime;
      }
      continue;
    }

    const quantum = quantumPerLevel[selectedLevel];
    const process = queues[selectedLevel].shift()!;
    const timeSlice = Math.min(quantum, process.remaining);

    timeline.push({
      pid: process.pid,
      start: currentTime,
      end: currentTime + timeSlice,
    });

    currentTime += timeSlice;
    process.remaining -= timeSlice;
    process.lastServedTime = currentTime;
    process.timesSliced++;

    // Add newly arrived processes
    while (processIndex < sortedByArrival.length && sortedByArrival[processIndex].arrivalTime <= currentTime) {
      const p = sortedByArrival[processIndex];
      p.level = 0;
      queues[0].push(p);
      processIndex++;
    }

    if (process.remaining > 0) {
      if (process.timesSliced >= demotionThreshold && selectedLevel < numLevels - 1) {
        // Demote to lower-priority queue
        process.level = selectedLevel + 1;
        process.timesSliced = 0;
        queues[selectedLevel + 1].push(process);
      } else {
        // Stay at current level
        queues[selectedLevel].push(process);
      }
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
    case 'priorityAging':
      return priorityAgingScheduling(processes, { agingInterval: 3, agingAmount: 1 });
    case 'multiLevelQueue':
      return multiLevelQueueScheduling(processes, {
        queues: [
          { name: 'System', priorityRange: { min: 0, max: 1 } },
          { name: 'Interactive', priorityRange: { min: 2, max: 3 } },
          { name: 'Batch', priorityRange: { min: 4, max: Number.MAX_SAFE_INTEGER } },
        ],
      });
    case 'multiLevelFeedback':
      return multiLevelFeedbackQueueScheduling(processes, {
        quantumPerLevel: [2, 4, 8],
        agingPromotionInterval: 10,
        demotionThreshold: 2,
      });
  }
}


export function runMultiCore(
  singleCoreResult: SimulationResult,
  coreCount: number
): SimulationResult {
  if (coreCount <= 1 || singleCoreResult.timeline.length === 0) {
    return singleCoreResult;
  }

  const coreCountCapped = Math.min(4, Math.max(1, coreCount));
  const coreFreeAt: number[] = new Array(coreCountCapped).fill(0);
  const newTimeline: TimelineSlice[] = [];

  for (const slice of singleCoreResult.timeline) {
    if (slice.pid === 'idle') {
      // Idle gaps are global; keep as-is on core 0
      newTimeline.push({ ...slice, core: 0 });
      continue;
    }

    // Find the core that frees up earliest
    let bestCore = 0;
    let bestTime = coreFreeAt[0];
    for (let c = 1; c < coreCountCapped; c++) {
      if (coreFreeAt[c] < bestTime) {
        bestTime = coreFreeAt[c];
        bestCore = c;
      }
    }

    const duration = slice.end - slice.start;
    const start = Math.max(slice.start, coreFreeAt[bestCore]);
    const end = start + duration;

    newTimeline.push({ pid: slice.pid, start, end, core: bestCore });
    coreFreeAt[bestCore] = end;
  }

  return {
    timeline: newTimeline,
    processResults: singleCoreResult.processResults,
    averageWaitingTime: singleCoreResult.averageWaitingTime,
    averageTurnaroundTime: singleCoreResult.averageTurnaroundTime,
    averageResponseTime: singleCoreResult.averageResponseTime,
  };
}
