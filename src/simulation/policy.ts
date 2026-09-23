import { ProcessRuntime, CoreRuntime, StopReason, SystemConfig, SimulationEventType } from "../domain/models";

export interface SchedulerContext {
  time: number;
  cores: CoreRuntime[];
  ready: ProcessRuntime[];
  all: Map<string, ProcessRuntime>;
  system: SystemConfig;
  schedule(time: number, type: SimulationEventType, opts?: { pid?: string; core?: number; payload?: Record<string, unknown> }): void;
}

export interface SchedulerPolicy {
  id: string;
  name: string;
  quantum?: number;
  quantumFor?(process: ProcessRuntime): number | undefined;
  ignoreQuantumWhenAlone?: boolean;
  yieldWhenAloneOnArrival?: boolean;
  onProcessArrival?(process: ProcessRuntime, context: SchedulerContext): void;
  onProcessReady?(process: ProcessRuntime, context: SchedulerContext): void;
  onTick?(context: SchedulerContext): void;
  selectNext(candidates: ProcessRuntime[], context: SchedulerContext): ProcessRuntime | null;
  shouldPreempt?(running: ProcessRuntime, candidates: ProcessRuntime[], context: SchedulerContext): boolean;
  onProcessRun?(process: ProcessRuntime, duration: number, context: SchedulerContext): void;
  onProcessStop?(process: ProcessRuntime, reason: StopReason, context: SchedulerContext): void;
}
