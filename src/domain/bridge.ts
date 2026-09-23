import { Process } from "../types";
import { ProcessSpec, ProcessRuntime } from "./models";
import { totalCpuTime } from "./validation";

export function toProcessSpec(p: Process): ProcessSpec {
  return {
    pid: p.pid,
    arrivalTime: p.arrivalTime,
    cpuBursts: [{ type: "cpu", duration: p.burstTime }],
    priority: p.priority,
  };
}

export function toProcessSpecs(processes: Process[]): ProcessSpec[] {
  return processes.map(toProcessSpec);
}

export function createRuntime(spec: ProcessSpec): ProcessRuntime {
  return {
    pid: spec.pid,
    state: "NEW",
    spec,
    currentBurstIndex: 0,
    remainingCpu: totalCpuTime(spec),
    remainingIo: 0,
    totalCpuExecuted: 0,
    totalIoTime: 0,
    contextSwitches: 0,
    preemptions: 0,
    migrations: 0,
    waitingTime: 0,
  };
}
