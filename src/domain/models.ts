export type ProcessState = "NEW" | "READY" | "RUNNING" | "BLOCKED" | "TERMINATED";

export type BurstType = "cpu" | "io";

export interface Burst {
  type: BurstType;
  duration: number;
}

export type ProcessClass = "system" | "interactive" | "batch" | "real-time";

export interface ProcessSpec {
  pid: string;
  arrivalTime: number;
  cpuBursts: Burst[];
  ioBursts?: Burst[];
  priority?: number;
  weight?: number;
  tickets?: number;
  deadline?: number;
  period?: number;
  affinity?: number[];
  class?: ProcessClass;
}

export interface ProcessRuntime {
  pid: string;
  state: ProcessState;
  spec: ProcessSpec;
  currentBurstIndex: number;
  remainingCpu: number;
  remainingIo: number;
  totalCpuExecuted: number;
  totalIoTime: number;
  contextSwitches: number;
  preemptions: number;
  migrations: number;
  readySince?: number;
  firstRunAt?: number;
  completionTime?: number;
  responseTime?: number;
  waitingTime: number;
  turnaroundTime?: number;
}

export type CoreState = "IDLE" | "RUNNING" | "CONTEXT_SWITCH";

export interface CoreRuntime {
  id: number;
  state: CoreState;
  runningPid?: string;
  freeAt: number;
  totalBusyTime: number;
  totalIdleTime: number;
  contextSwitches: number;
}

export type SliceKind = "EXECUTION" | "IDLE" | "CONTEXT_SWITCH" | "IO" | "INTERRUPT";

export interface TimelineSlice {
  pid: string | "idle";
  start: number;
  end: number;
  core?: number;
  kind?: SliceKind;
}

export type SimulationEventType =
  | "PROCESS_ARRIVAL"
  | "CPU_BURST_COMPLETE"
  | "IO_COMPLETE"
  | "QUANTUM_EXPIRE"
  | "PREEMPT"
  | "DISPATCH"
  | "CONTEXT_SWITCH_COMPLETE"
  | "DEADLINE"
  | "AGING_TICK"
  | "LOAD_BALANCE"
  | "MIGRATION"
  | "PROCESS_TERMINATE";

export interface SimulationEvent {
  id: number;
  time: number;
  type: SimulationEventType;
  pid?: string;
  core?: number;
  payload: Record<string, unknown>;
}

export type StopReason = "COMPLETED" | "PREEMPTED" | "QUANTUM_EXPIRED" | "BLOCKED" | "MIGRATED";

export interface SystemConfig {
  coreCount: number;
  contextSwitchCost: number;
  dispatchLatency: number;
  migrationCost: number;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  coreCount: 1,
  contextSwitchCost: 0,
  dispatchLatency: 0,
  migrationCost: 0,
};

export interface ProcessResult {
  pid: string;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
  completionTime: number;
  contextSwitches?: number;
  deadlineMiss?: boolean;
}

export interface DecisionEntry {
  time: number;
  message: string;
}

export interface ExtendedMetrics {
  throughput: number;
  cpuUtilization: number;
  contextSwitchCount: number;
  jainFairness: number;
  waitingP50: number;
  waitingP95: number;
  deadlineMisses: number;
}

export interface SimulationResult {
  timeline: TimelineSlice[];
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
  averageResponseTime: number;
  decisionLog?: DecisionEntry[];
  events?: SimulationEvent[];
  explanations?: DecisionExplanation[];
  metrics?: ExtendedMetrics;
}

export interface CandidateExplanation {
  pid: string;
  value: number;
  label: string;
}

export interface DecisionExplanation {
  decisionId: string;
  time: number;
  rule: string;
  candidates: CandidateExplanation[];
  selected: string | null;
  reason: string;
  consequences: string[];
}
