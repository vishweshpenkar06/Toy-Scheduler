import { Process, AlgorithmType, SimulationResult, RunOptions } from "../types";
import { SimulationKernel } from "../simulation/SimulationKernel";
import {
  fcfsPolicy,
  sjfPolicy,
  srtfPolicy,
  roundRobinPolicy,
  priorityPolicy,
  agingPolicy,
  multiLevelQueuePolicy,
  multiLevelFeedbackPolicy,
  hrrnPolicy,
  lrtfPolicy,
  lotteryPolicy,
  stridePolicy,
  wfqPolicy,
  edfPolicy,
  rmsPolicy,
  adaptivePolicy,
} from "../simulation/policies";
import { SchedulerPolicy } from "../simulation/policy";
import { fifo, sjf, srtf, roundRobin, priorityScheduling, priorityAgingScheduling, multiLevelQueueScheduling, multiLevelFeedbackQueueScheduling } from "./scheduler";

export const DEFAULT_MLQ_QUEUES = [
  { name: "System", priorityRange: { min: 0, max: 1 } },
  { name: "Interactive", priorityRange: { min: 2, max: 3 } },
  { name: "Batch", priorityRange: { min: 4, max: Number.MAX_SAFE_INTEGER } },
] as const;

export const DEFAULT_MLFQ = {
  quantumPerLevel: [2, 4, 8],
  agingPromotionInterval: 10,
  demotionThreshold: 2,
};

export function createPolicy(
  algorithm: AlgorithmType,
  options?: { quantum?: number }
): SchedulerPolicy {
  const q = options?.quantum ?? 2;
  switch (algorithm) {
    case "fifo":
      return fcfsPolicy;
    case "sjf":
      return sjfPolicy;
    case "srtf":
      return srtfPolicy;
    case "roundRobin":
      return roundRobinPolicy(q);
    case "priorityNonPreemptive":
      return priorityPolicy(false);
    case "priorityPreemptive":
      return priorityPolicy(true);
    case "priorityAging":
      return agingPolicy(3, 1);
    case "multiLevelQueue":
      return multiLevelQueuePolicy(DEFAULT_MLQ_QUEUES.map((x) => ({ ...x })));
    case "multiLevelFeedback":
      return multiLevelFeedbackPolicy(
        DEFAULT_MLFQ.quantumPerLevel,
        DEFAULT_MLFQ.agingPromotionInterval,
        DEFAULT_MLFQ.demotionThreshold
      );
    case "hrrn":
      return hrrnPolicy;
    case "lrtf":
      return lrtfPolicy;
    case "lottery":
      return lotteryPolicy();
    case "stride":
      return stridePolicy;
    case "wfq":
      return wfqPolicy;
    case "edf":
      return edfPolicy;
    case "rms":
      return rmsPolicy;
    case "adaptive":
      return adaptivePolicy(q);
  }
}

export function runAlgorithmOnKernel(
  algorithm: AlgorithmType,
  processes: Process[],
  options?: RunOptions
): SimulationResult {
  if (algorithm === "roundRobin" || algorithm === "adaptive") {
    const q = options?.quantum ?? 1;
    if (q <= 0 || !Number.isInteger(q)) {
      throw new Error(`Invalid quantum: must be a positive integer, got ${q}`);
    }
  }
  const policy = createPolicy(algorithm, options);
  const coreCount = Math.min(16, Math.max(1, Math.floor(options?.coreCount ?? 1)));
  const contextSwitchCost = Math.max(0, Math.floor(options?.contextSwitchCost ?? 0));
  return new SimulationKernel(policy, {
    system: { coreCount, contextSwitchCost },
    seed: options?.seed ?? 1,
  }).run(processes);
}

export function runAlgorithm(
  algorithm: AlgorithmType,
  processes: Process[],
  options?: RunOptions
): SimulationResult {
  return runAlgorithmOnKernel(algorithm, processes, options);
}

// Legacy implementations retained for regression comparison in tests.
export {
  fifo,
  sjf,
  srtf,
  roundRobin,
  priorityScheduling,
  priorityAgingScheduling,
  multiLevelQueueScheduling,
  multiLevelFeedbackQueueScheduling,
};
