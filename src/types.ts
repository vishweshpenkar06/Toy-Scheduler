export interface Process {
  pid: string;
  arrivalTime: number;
  burstTime: number;
  priority?: number;
  color?: string;
}

export interface TimelineSlice {
  pid: string | "idle";
  start: number;
  end: number;
  core?: number;
}

export interface ProcessResult {
  pid: string;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
  completionTime: number;
}

export interface DecisionEntry {
  time: number;
  message: string;
}

export interface SimulationResult {
  timeline: TimelineSlice[];
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
  averageResponseTime: number;
  decisionLog?: DecisionEntry[];
}

export interface RoundRobinOptions {
  quantum: number;
}

export interface PrioritySchedulingOptions {
  preemptive: boolean;
}

export interface PriorityAgingOptions {
  agingInterval: number;
  agingAmount: number;
}

export interface QueueDefinition {
  name: string;
  algorithm?: AlgorithmType;
  priorityRange?: { min: number; max: number };
}

export interface MultiLevelQueueOptions {
  queues: QueueDefinition[];
}

export interface MultiLevelFeedbackOptions {
  quantumPerLevel: number[];
  agingPromotionInterval?: number;
  demotionThreshold?: number;
}

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
