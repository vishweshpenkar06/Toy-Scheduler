/**
 * Represents a process to be scheduled
 */
export interface Process {
  pid: string;
  arrivalTime: number;
  burstTime: number;
  priority?: number; // Lower number = higher priority
  color?: string;    // Custom badge color (HEX/HSL)
}

/**
 * Represents a slice of time on the CPU timeline
 */
export interface TimelineSlice {
  pid: string | "idle";
  start: number;
  end: number;
}

/**
 * Metrics for a single process after scheduling
 */
export interface ProcessResult {
  pid: string;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
  completionTime: number;
}

/**
 * Complete simulation result including timeline and metrics
 */
export interface SimulationResult {
  timeline: TimelineSlice[];
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
  averageResponseTime: number;
}

/**
 * Options for Round Robin scheduling
 */
export interface RoundRobinOptions {
  quantum: number;
}

/**
 * Options for Priority scheduling
 */
export interface PrioritySchedulingOptions {
  preemptive: boolean;
}

/**
 * Options for Priority scheduling with aging
 */
export interface PriorityAgingOptions {
  agingInterval: number;
  agingAmount: number;
}

/**
 * A queue definition for Multilevel Queue scheduling
 */
export interface QueueDefinition {
  name: string;
  algorithm: AlgorithmType;
  priorityRange?: { min: number; max: number };
}

/**
 * Options for Multilevel Queue scheduling
 */
export interface MultiLevelQueueOptions {
  queues: QueueDefinition[];
}

/**
 * Options for Multilevel Feedback Queue scheduling
 */
export interface MultiLevelFeedbackOptions {
  quantumPerLevel: number[];
  agingPromotionInterval?: number;
  demotionThreshold?: number;
}

/**
 * Algorithm identifiers supported by the engine
 */
export type AlgorithmType = 'fifo' | 'sjf' | 'srtf' | 'roundRobin' | 'priorityNonPreemptive' | 'priorityPreemptive' | 'priorityAging' | 'multiLevelQueue' | 'multiLevelFeedback';

export interface AlgorithmInfo {
  id: AlgorithmType;
  name: string;
  shortName: string;
  description: string;
  isPreemptive: boolean;
  requiresQuantum?: boolean;
  requiresPriority?: boolean;
}

export interface PresetWorkload {
  id: string;
  name: string;
  description: string;
  processes: Process[];
  defaultAlgorithm?: AlgorithmType;
  defaultQuantum?: number;
}
