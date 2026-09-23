import { Burst, ProcessSpec } from "./models";

export function validateBurst(burst: Burst, pid: string, index: number, kind: string): string | null {
  if (burst.type !== "cpu" && burst.type !== "io") {
    return `Process ${pid} ${kind} burst ${index} has invalid type: ${String(burst.type)}`;
  }
  if (!Number.isFinite(burst.duration) || !Number.isInteger(burst.duration)) {
    return `Process ${pid} ${kind} burst ${index} has invalid duration: ${burst.duration}`;
  }
  if (burst.duration <= 0) {
    return `Process ${pid} ${kind} burst ${index} has non-positive duration: ${burst.duration}`;
  }
  return null;
}

export function validateProcessSpec(spec: ProcessSpec): string | null {
  if (!spec.pid || !spec.pid.trim()) return "Process ID is required.";
  if (!Number.isFinite(spec.arrivalTime) || !Number.isInteger(spec.arrivalTime)) {
    return `Process ${spec.pid} has invalid arrivalTime: ${spec.arrivalTime}`;
  }
  if (spec.arrivalTime < 0) {
    return `Process ${spec.pid} has negative arrivalTime: ${spec.arrivalTime}`;
  }
  if (!Array.isArray(spec.cpuBursts) || spec.cpuBursts.length === 0) {
    return `Process ${spec.pid} must have at least one CPU burst`;
  }
  for (let i = 0; i < spec.cpuBursts.length; i++) {
    const err = validateBurst(spec.cpuBursts[i], spec.pid, i, "cpu");
    if (err) return err;
  }
  if (spec.ioBursts) {
    const cpuCount = spec.cpuBursts.length;
    if (spec.ioBursts.length >= cpuCount) {
      return `Process ${spec.pid} must end with a CPU burst (io bursts < cpu bursts)`;
    }
    for (let i = 0; i < spec.ioBursts.length; i++) {
      const err = validateBurst(spec.ioBursts[i], spec.pid, i, "io");
      if (err) return err;
    }
  }
  if (spec.deadline !== undefined) {
    if (!Number.isFinite(spec.deadline) || !Number.isInteger(spec.deadline) || spec.deadline < spec.arrivalTime) {
      return `Process ${spec.pid} has invalid deadline: ${spec.deadline}`;
    }
  }
  if (spec.period !== undefined && (!Number.isFinite(spec.period) || spec.period <= 0)) {
    return `Process ${spec.pid} has invalid period: ${spec.period}`;
  }
  if (spec.weight !== undefined && (!Number.isFinite(spec.weight) || spec.weight <= 0)) {
    return `Process ${spec.pid} has invalid weight: ${spec.weight}`;
  }
  if (spec.tickets !== undefined && (!Number.isInteger(spec.tickets) || spec.tickets <= 0)) {
    return `Process ${spec.pid} has invalid tickets: ${spec.tickets}`;
  }
  return null;
}

export function validateProcessSpecs(specs: ProcessSpec[]): void {
  const pids = new Set<string>();
  for (const spec of specs) {
    if (pids.has(spec.pid)) throw new Error(`Duplicate process ID found: ${spec.pid}`);
    pids.add(spec.pid);
    const message = validateProcessSpec(spec);
    if (message) throw new Error(message);
  }
}

export function totalCpuTime(spec: ProcessSpec): number {
  return spec.cpuBursts.reduce((sum, b) => sum + b.duration, 0);
}
