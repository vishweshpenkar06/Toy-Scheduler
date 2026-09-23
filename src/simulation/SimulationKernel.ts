import {
  ProcessResult,
  SimulationEvent,
  SimulationEventType,
  SystemConfig,
  CoreRuntime,
  ProcessRuntime,
  TimelineSlice,
  SimulationResult,
  DEFAULT_SYSTEM_CONFIG,
} from "../domain/models";
import { toProcessSpecs, interleavedBursts } from "../domain/bridge";
import { validateProcessSpecs, totalCpuTime } from "../domain/validation";
import { createRuntime } from "../domain/bridge";
import { Process } from "../types";
import { EventQueue } from "./EventQueue";
import { SchedulerContext, SchedulerPolicy } from "./policy";
import { computeExtendedMetrics } from "../engine/metrics";

interface RunningSlot {
  coreId: number;
  pid: string;
  dispatchSeq: number;
  dispatchTime: number;
}

export interface KernelOptions {
  system?: Partial<SystemConfig>;
  seed?: number;
}

function emptyResult(): SimulationResult {
  return {
    timeline: [],
    processResults: [],
    averageWaitingTime: 0,
    averageTurnaroundTime: 0,
    averageResponseTime: 0,
    events: [],
    metrics: {
      throughput: 0,
      cpuUtilization: 0,
      contextSwitchCount: 0,
      jainFairness: 1,
      waitingP50: 0,
      waitingP95: 0,
      deadlineMisses: 0,
    },
  };
}

export class SimulationKernel {
  private policy: SchedulerPolicy;
  private system: SystemConfig;
  private seed: number;
  private runtimes = new Map<string, ProcessRuntime>();
  private cores: CoreRuntime[] = [];
  private ready: ProcessRuntime[] = [];
  private blocked = new Map<string, { start: number; end: number }>();
  private eventQueue = new EventQueue();
  private events: SimulationEvent[] = [];
  private timeline: TimelineSlice[] = [];
  private time = 0;
  private eventSeq = 0;
  private dispatchSeq = 0;
  private running = new Map<number, RunningSlot>();
  private contextSwitchCount = 0;
  private rngState: number;

  constructor(policy: SchedulerPolicy, options: KernelOptions = {}) {
    this.policy = policy;
    this.system = { ...DEFAULT_SYSTEM_CONFIG, ...options.system };
    this.seed = options.seed ?? 1;
    this.rngState = this.seed >>> 0 || 1;
  }

  nextRandom(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 0xffffffff;
  }

  private emit(time: number, type: SimulationEventType, opts: { pid?: string; core?: number; payload?: Record<string, unknown> } = {}): void {
    const event: SimulationEvent = {
      id: this.eventSeq++,
      time,
      type,
      pid: opts.pid,
      core: opts.core,
      payload: opts.payload ?? {},
    };
    this.eventQueue.push(event);
  }

  private makeContext(): SchedulerContext {
    return {
      time: this.time,
      cores: this.cores,
      ready: this.ready,
      all: this.runtimes,
      system: this.system,
      schedule: (time, type, opts) => this.emit(time, type, opts ?? {}),
      random: () => this.nextRandom(),
    };
  }

  private pushReady(rt: ProcessRuntime): void {
    if (rt.state === "TERMINATED") return;
    if (!this.ready.includes(rt)) this.ready.push(rt);
    rt.state = "READY";
    rt.readySince ??= this.time;
    this.policy.onProcessReady?.(rt, this.makeContext());
  }

  private removeReady(pid: string): void {
    this.ready = this.ready.filter((p) => p.pid !== pid);
  }

  private advanceRunning(until: number): void {
    const dt = until - this.time;
    if (dt <= 0) return;
    for (const slot of this.running.values()) {
      const rt = this.runtimes.get(slot.pid);
      if (!rt) continue;
      const executed = Math.min(dt, rt.remainingCpu);
      rt.remainingCpu -= executed;
      rt.totalCpuExecuted += executed;
      const core = this.cores[slot.coreId];
      core.totalBusyTime += executed;
      if (rt.remainingCpu <= 0) {
        rt.remainingCpu = 0;
      }
    }
  }

  private emitIdle(from: number, to: number): void {
    if (to <= from) return;
    this.timeline.push({ pid: "idle", start: from, end: to, core: 0, kind: "IDLE" });
  }

  private hasPendingWork(): boolean {
    if (this.ready.length > 0 || this.blocked.size > 0) return true;
    for (const rt of this.runtimes.values()) {
      if (rt.state === "NEW") return true;
    }
    return false;
  }

  private startContextSwitch(coreId: number): void {
    const cost = this.system.contextSwitchCost;
    if (cost <= 0) return;
    const core = this.cores[coreId];
    const csEnd = this.time + cost;
    this.timeline.push({ pid: "idle", start: this.time, end: csEnd, core: coreId, kind: "CONTEXT_SWITCH" });
    core.freeAt = csEnd;
    core.state = "CONTEXT_SWITCH";
    core.contextSwitches += 1;
    this.contextSwitchCount += 1;
    this.emit(csEnd, "CONTEXT_SWITCH_COMPLETE", { core: coreId });
  }

  private stopRunning(
    coreId: number,
    reason: "COMPLETED" | "PREEMPTED" | "QUANTUM_EXPIRED" | "BLOCKED"
  ): void {
    const slot = this.running.get(coreId);
    if (!slot) return;
    const rt = this.runtimes.get(slot.pid);
    this.running.delete(coreId);
    const core = this.cores[coreId];
    core.state = "IDLE";
    core.runningPid = undefined;
    if (!rt) return;

    const end = this.time;
    if (end > slot.dispatchTime) {
      this.timeline.push({
        pid: rt.pid,
        start: slot.dispatchTime,
        end,
        core: coreId,
        kind: "EXECUTION",
      });
    }

    if (reason === "COMPLETED") {
      rt.state = "TERMINATED";
      rt.completionTime = this.time;
      rt.responseTime ??= Math.max(0, slot.dispatchTime - rt.spec.arrivalTime);
      this.policy.onProcessStop?.(rt, "COMPLETED", this.makeContext());
      this.emit(this.time, "PROCESS_TERMINATE", { pid: rt.pid, core: coreId });
      if (this.hasPendingWork()) this.startContextSwitch(coreId);
    } else if (reason === "BLOCKED") {
      rt.contextSwitches += 1;
      core.contextSwitches += 1;
      this.policy.onProcessStop?.(rt, reason, this.makeContext());
      if (this.hasPendingWork()) this.startContextSwitch(coreId);
    } else {
      rt.preemptions += reason === "PREEMPTED" ? 1 : 0;
      rt.contextSwitches += 1;
      core.contextSwitches += 1;
      this.policy.onProcessStop?.(rt, reason, this.makeContext());
      this.pushReady(rt);
      if (this.hasPendingWork()) this.startContextSwitch(coreId);
      if (reason === "QUANTUM_EXPIRED") {
        this.emit(this.time, "QUANTUM_EXPIRE", { pid: rt.pid, core: coreId, payload: { dispatchSeq: slot.dispatchSeq } });
      } else {
        this.emit(this.time, "PREEMPT", { pid: rt.pid, core: coreId, payload: { dispatchSeq: slot.dispatchSeq } });
      }
    }
  }

  private advanceBurst(rt: ProcessRuntime): "terminate" | "io" | "cpu" {
    const bursts = interleavedBursts(rt.spec);
    if (rt.currentBurstIndex >= bursts.length - 1) return "terminate";
    const next = bursts[rt.currentBurstIndex + 1];
    if (next.type === "io") return "io";
    rt.currentBurstIndex += 1;
    rt.remainingCpu = next.duration;
    return "cpu";
  }

  private beginIo(rt: ProcessRuntime, coreId: number): void {
    const bursts = interleavedBursts(rt.spec);
    const ioBurst = bursts[rt.currentBurstIndex + 1];
    if (!ioBurst || ioBurst.type !== "io") return;
    rt.state = "BLOCKED";
    rt.remainingIo = ioBurst.duration;
    const end = this.time + ioBurst.duration;
    this.blocked.set(rt.pid, { start: this.time, end });
    this.timeline.push({ pid: rt.pid, start: this.time, end, core: coreId, kind: "IO" });
    this.emit(end, "IO_COMPLETE", { pid: rt.pid, core: coreId });
  }

  private preemptWorstIfNeeded(runningSlots: RunningSlot[]): boolean {
    if (!this.policy.shouldPreempt) return false;
    const context = this.makeContext();
    let worst: RunningSlot | null = null;
    let worstRemaining = -1;
    for (const slot of runningSlots) {
      const rt = this.runtimes.get(slot.pid);
      if (!rt) continue;
      if (this.policy.shouldPreempt(rt, [...this.ready], context)) {
        if (rt.remainingCpu > worstRemaining) {
          worstRemaining = rt.remainingCpu;
          worst = slot;
        }
      }
    }
    if (worst) {
      this.stopRunning(worst.coreId, "PREEMPTED");
      return true;
    }
    return false;
  }

  private dispatchOn(coreId: number): boolean {
    if (this.running.has(coreId)) return false;
    const core = this.cores[coreId];
    if (this.time < core.freeAt) return false;
    if (core.state === "CONTEXT_SWITCH") return false;

    const context = this.makeContext();
    const selected = this.policy.selectNext([...this.ready], context);
    if (!selected) return false;

    this.removeReady(selected.pid);
    const isFirstRun = selected.firstRunAt === undefined;
    selected.state = "RUNNING";
    selected.firstRunAt ??= this.time;
    if (isFirstRun) {
      selected.responseTime = Math.max(0, this.time - selected.spec.arrivalTime);
    } else {
      selected.contextSwitches += 1;
    }

    core.state = "RUNNING";
    core.runningPid = selected.pid;
    this.dispatchSeq += 1;
    const seq = this.dispatchSeq;
    this.running.set(coreId, {
      coreId,
      pid: selected.pid,
      dispatchSeq: seq,
      dispatchTime: this.time,
    });

    this.policy.onProcessRun?.(selected, selected.remainingCpu, this.makeContext());
    this.emit(this.time, "DISPATCH", { pid: selected.pid, core: coreId, payload: { dispatchSeq: seq } });

    const remaining = selected.remainingCpu;
    if (remaining > 0) {
      this.emit(this.time + remaining, "CPU_BURST_COMPLETE", {
        pid: selected.pid,
        core: coreId,
        payload: { dispatchSeq: seq },
      });
    }
    const quantum = this.policy.quantumFor?.(selected) ?? this.policy.quantum;
    if (quantum !== undefined && Number.isFinite(quantum) && quantum > 0) {
      this.emit(this.time + quantum, "QUANTUM_EXPIRE", {
        pid: selected.pid,
        core: coreId,
        payload: { dispatchSeq: seq },
      });
    }
    return true;
  }

  private tryDispatchAll(): void {
    for (let c = 0; c < this.cores.length; c++) {
      if (this.ready.length === 0) break;
      this.dispatchOn(c);
    }
    if (
      this.policy.shouldPreempt &&
      this.ready.length > 0 &&
      this.running.size === this.cores.length &&
      this.cores.length > 0 &&
      this.preemptWorstIfNeeded([...this.running.values()])
    ) {
      this.tryDispatchAll();
    }
  }

  private isStale(event: SimulationEvent): boolean {
    const slot = event.core !== undefined ? this.running.get(event.core) : undefined;
    const wanted = event.payload.dispatchSeq;
    if (wanted === undefined) return false;
    if (!slot || slot.dispatchSeq !== wanted) return true;
    if (event.pid && slot.pid !== event.pid) return true;
    return false;
  }

  private handleEvent(event: SimulationEvent): void {
    this.policy.onTick?.(this.makeContext());

    switch (event.type) {
      case "PROCESS_ARRIVAL": {
        const rt = this.runtimes.get(event.pid!);
        if (rt && rt.state === "NEW") {
          rt.state = "READY";
          rt.readySince = this.time;
          this.policy.onProcessArrival?.(rt, this.makeContext());
          const wasAlone =
            this.policy.yieldWhenAloneOnArrival &&
            this.running.size === 1 &&
            this.ready.length === 0;
          const runningSlots = [...this.running.values()];
          this.pushReady(rt);

          const hasFreeCore = this.running.size < this.cores.length;
          if (hasFreeCore) {
            // free core — dispatch handles it
          } else if (wasAlone && runningSlots.length > 0) {
            this.stopRunning(runningSlots[0].coreId, "PREEMPTED");
          } else if (this.policy.shouldPreempt && runningSlots.length > 0) {
            this.preemptWorstIfNeeded(runningSlots);
          }
        }
        break;
      }
      case "CPU_BURST_COMPLETE": {
        if (this.isStale(event)) break;
        const slot = event.core !== undefined ? this.running.get(event.core) : undefined;
        if (slot && slot.pid === event.pid) {
          this.advanceRunning(this.time);
          const rt = this.runtimes.get(event.pid!);
          if (rt && rt.remainingCpu <= 0) {
            const next = this.advanceBurst(rt);
            if (next === "terminate") {
              this.stopRunning(event.core!, "COMPLETED");
            } else if (next === "io") {
              this.stopRunning(event.core!, "BLOCKED");
              this.beginIo(rt, event.core!);
            } else {
              // next CPU burst without IO — requeue
              this.stopRunning(event.core!, "PREEMPTED");
            }
          }
        }
        break;
      }
      case "IO_COMPLETE": {
        const rt = this.runtimes.get(event.pid!);
        if (rt && rt.state === "BLOCKED") {
            const interval = this.blocked.get(rt.pid);
            if (interval) {
              interval.end = this.time;
              this.blocked.delete(rt.pid);
            }
          const bursts = interleavedBursts(rt.spec);
          // currentBurstIndex points at the CPU burst before this IO; skip IO to next CPU
          const nextCpuIdx = rt.currentBurstIndex + 2;
          if (nextCpuIdx < bursts.length && bursts[nextCpuIdx].type === "cpu") {
            rt.currentBurstIndex = nextCpuIdx;
            rt.remainingCpu = bursts[nextCpuIdx].duration;
            rt.remainingIo = 0;
            this.pushReady(rt);
          }
        }
        break;
      }
      case "QUANTUM_EXPIRE": {
        if (this.isStale(event)) break;
        const slot = event.core !== undefined ? this.running.get(event.core) : undefined;
        if (slot && slot.pid === event.pid) {
          const rt = this.runtimes.get(event.pid!);
          if (rt && rt.remainingCpu > 0) {
            if (this.policy.ignoreQuantumWhenAlone && this.ready.length === 0) {
              const q = this.policy.quantumFor?.(rt) ?? this.policy.quantum;
              if (q !== undefined && q > 0) {
                this.emit(this.time + q, "QUANTUM_EXPIRE", {
                  pid: rt.pid,
                  core: event.core,
                  payload: { dispatchSeq: slot.dispatchSeq },
                });
              }
              break;
            }
            this.stopRunning(event.core!, "QUANTUM_EXPIRED");
          }
        }
        break;
      }
      case "AGING_TICK": {
        for (const coreId of [...this.running.keys()]) {
          this.stopRunning(coreId, "PREEMPTED");
        }
        break;
      }
      case "PREEMPT": {
        if (this.isStale(event)) break;
        const slot = event.core !== undefined ? this.running.get(event.core) : undefined;
        if (slot && slot.pid === event.pid) {
          this.stopRunning(event.core!, "PREEMPTED");
        }
        break;
      }
      case "CONTEXT_SWITCH_COMPLETE": {
        const core = event.core !== undefined ? this.cores[event.core] : undefined;
        if (core && core.state === "CONTEXT_SWITCH") {
          core.state = "IDLE";
        }
        break;
      }
      default:
        break;
    }
  }

  private processEvent(event: SimulationEvent): void {
    if (event.time > this.time) {
      const anyRunning = this.running.size > 0;
      const anyCs = this.cores.some((c) => c.state === "CONTEXT_SWITCH");
      this.advanceRunning(event.time);
      if (!anyRunning && !anyCs) {
        this.emitIdle(this.time, event.time);
      }
      this.time = event.time;
    }
    this.handleEvent(event);
  }

  private runEventLoop(): void {
    while (this.eventQueue.size > 0) {
      const now = this.eventQueue.peek()!.time;

      while (this.eventQueue.size > 0 && this.eventQueue.peek()!.time <= now) {
        const event = this.eventQueue.pop()!;
        this.events.push(event);
        this.processEvent(event);
      }

      this.tryDispatchAll();
    }
  }

  private computeProcessResults(): ProcessResult[] {
    const processResults: ProcessResult[] = [];
    for (const rt of this.runtimes.values()) {
      const completion = rt.completionTime ?? 0;
      const turnaround = completion - rt.spec.arrivalTime;
      const waiting = turnaround - totalCpuTime(rt.spec);
      const response = rt.responseTime ?? 0;
      const deadlineMiss =
        rt.spec.deadline !== undefined ? completion > rt.spec.deadline : undefined;
      processResults.push({
        pid: rt.pid,
        waitingTime: waiting,
        turnaroundTime: turnaround,
        responseTime: response,
        completionTime: completion,
        contextSwitches: rt.contextSwitches,
        ...(deadlineMiss !== undefined ? { deadlineMiss } : {}),
      });
    }
    return processResults;
  }

  run(processes: Process[]): SimulationResult {
    if (processes.length === 0) return emptyResult();

    const specs = toProcessSpecs(processes);
    validateProcessSpecs(specs);

    const coreCount = Math.max(1, Math.floor(this.system.coreCount));
    this.system = { ...this.system, coreCount };
    this.cores = Array.from({ length: coreCount }, (_, id) => ({
      id,
      state: "IDLE" as const,
      freeAt: 0,
      totalBusyTime: 0,
      totalIdleTime: 0,
      contextSwitches: 0,
    }));

    for (const spec of specs) {
      this.runtimes.set(spec.pid, createRuntime(spec));
      this.emit(spec.arrivalTime, "PROCESS_ARRIVAL", { pid: spec.pid });
    }

    this.runEventLoop();

    if (this.running.size > 0) {
      let maxEnd = 0;
      for (const slot of this.running.values()) {
        const rt = this.runtimes.get(slot.pid);
        if (rt) maxEnd = Math.max(maxEnd, this.time + rt.remainingCpu);
      }
      this.advanceRunning(maxEnd);
      for (const coreId of [...this.running.keys()]) {
        this.stopRunning(coreId, "COMPLETED");
      }
      this.time = maxEnd;
      this.runEventLoop();
    }

    this.timeline.sort((a, b) => a.start - b.start || (a.core ?? 0) - (b.core ?? 0));

    const processResults = this.computeProcessResults();
    const n = processResults.length || 1;
    const avg = (pick: (r: ProcessResult) => number) =>
      processResults.reduce((s, r) => s + pick(r), 0) / n;

    const span = this.timeline.reduce((m, s) => Math.max(m, s.end), 0);
    const metrics = computeExtendedMetrics({
      processResults,
      timeline: this.timeline,
      span,
      coreCount,
      contextSwitchCount: this.contextSwitchCount,
      processCount: processResults.length,
      deadlines: processResults.filter((r) => r.deadlineMiss !== undefined).length,
      deadlineMisses: processResults.filter((r) => r.deadlineMiss).length,
    });

    return {
      timeline: this.timeline,
      processResults,
      averageWaitingTime: avg((r) => r.waitingTime),
      averageTurnaroundTime: avg((r) => r.turnaroundTime),
      averageResponseTime: avg((r) => r.responseTime),
      events: this.events,
      metrics,
    };
  }
}
