import { Process } from "../types";
import { ProcessSpec, ProcessRuntime } from "./models";
import { totalCpuTime } from "./validation";

export function toProcessSpec(p: Process): ProcessSpec {
  if (p.bursts && p.bursts.length > 0) {
    const cpuBursts = p.bursts.filter((b) => b.type === "cpu");
    const ioBursts = p.bursts.filter((b) => b.type === "io");
    if (cpuBursts.length === 0) {
      throw new Error(`Process ${p.pid} must have at least one CPU burst`);
    }
    return {
      pid: p.pid,
      arrivalTime: p.arrivalTime,
      cpuBursts,
      ioBursts: ioBursts.length > 0 ? ioBursts : undefined,
      priority: p.priority,
      weight: p.weight,
      tickets: p.tickets,
      deadline: p.deadline,
      period: p.period,
    };
  }
  return {
    pid: p.pid,
    arrivalTime: p.arrivalTime,
    cpuBursts: [{ type: "cpu", duration: p.burstTime }],
    priority: p.priority,
    weight: p.weight,
    tickets: p.tickets,
    deadline: p.deadline,
    period: p.period,
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
    remainingCpu: spec.cpuBursts[0]?.duration ?? totalCpuTime(spec),
    remainingIo: 0,
    totalCpuExecuted: 0,
    totalIoTime: 0,
    contextSwitches: 0,
    preemptions: 0,
    migrations: 0,
    waitingTime: 0,
  };
}

export function interleavedBursts(spec: ProcessSpec): { type: "cpu" | "io"; duration: number }[] {
  const io = spec.ioBursts ?? [];
  const out: { type: "cpu" | "io"; duration: number }[] = [];
  for (let i = 0; i < spec.cpuBursts.length; i++) {
    out.push({ type: "cpu", duration: spec.cpuBursts[i].duration });
    if (i < io.length) out.push({ type: "io", duration: io[i].duration });
  }
  return out;
}
