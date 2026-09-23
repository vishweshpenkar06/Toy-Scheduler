import { SchedulerPolicy } from "./policy";
import { ProcessRuntime } from "../domain/models";

const NO_PRIORITY = Number.MAX_SAFE_INTEGER;

function byArrival(a: ProcessRuntime, b: ProcessRuntime): number {
  return a.spec.arrivalTime - b.spec.arrivalTime || a.pid.localeCompare(b.pid);
}

function totalBurst(rt: ProcessRuntime): number {
  return rt.spec.cpuBursts.reduce((s, b) => s + b.duration, 0);
}

function pickBest(
  candidates: ProcessRuntime[],
  score: (rt: ProcessRuntime) => number
): ProcessRuntime | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestScore = score(best);
  for (let i = 1; i < candidates.length; i++) {
    const s = score(candidates[i]);
    if (s < bestScore || (s === bestScore && candidates[i].pid.localeCompare(best.pid) < 0)) {
      best = candidates[i];
      bestScore = s;
    }
  }
  return best;
}

export const fcfsPolicy: SchedulerPolicy = {
  id: "fifo",
  name: "First-Come First-Served",
  selectNext(candidates) {
    if (candidates.length === 0) return null;
    return [...candidates].sort(byArrival)[0];
  },
};

export const sjfPolicy: SchedulerPolicy = {
  id: "sjf",
  name: "Shortest Job First",
  selectNext(candidates) {
    return pickBest(candidates, totalBurst);
  },
};

export const srtfPolicy: SchedulerPolicy = {
  id: "srtf",
  name: "Shortest Remaining Time First",
  selectNext(candidates) {
    return pickBest(candidates, (rt) => rt.remainingCpu);
  },
  shouldPreempt(running, candidates) {
    const best = pickBest(candidates, (rt) => rt.remainingCpu);
    if (!best) return false;
    if (best.remainingCpu < running.remainingCpu) return true;
    return best.remainingCpu === running.remainingCpu && best.pid.localeCompare(running.pid) < 0;
  },
};

export function roundRobinPolicy(quantum: number): SchedulerPolicy {
  return {
    id: "roundRobin",
    name: "Round Robin",
    quantum,
    ignoreQuantumWhenAlone: true,
    yieldWhenAloneOnArrival: true,
    selectNext(candidates) {
      if (candidates.length === 0) return null;
      return candidates[0];
    },
  };
}

function priorityOf(rt: ProcessRuntime): number {
  return rt.spec.priority ?? NO_PRIORITY;
}

export function priorityPolicy(preemptive: boolean): SchedulerPolicy {
  return {
    id: preemptive ? "priorityPreemptive" : "priorityNonPreemptive",
    name: preemptive ? "Priority (preemptive)" : "Priority (non-preemptive)",
    selectNext(candidates) {
      return pickBest(candidates, priorityOf);
    },
    shouldPreempt: preemptive
      ? (running, candidates) => {
          const best = pickBest(candidates, priorityOf);
          if (!best) return false;
          if (priorityOf(best) < priorityOf(running)) return true;
          return priorityOf(best) === priorityOf(running) && best.pid.localeCompare(running.pid) < 0;
        }
      : undefined,
  };
}

export function agingPolicy(agingInterval: number, agingAmount: number): SchedulerPolicy {
  const effective = new Map<string, number>();
  const lastCheck = new Map<string, number>();
  const scheduledTicks = new Set<number>();

  const seed = (rt: ProcessRuntime) => {
    if (!effective.has(rt.pid)) {
      effective.set(rt.pid, rt.spec.priority ?? NO_PRIORITY);
      lastCheck.set(rt.pid, 0);
    }
  };

  const effPriority = (rt: ProcessRuntime) =>
    effective.get(rt.pid) ?? rt.spec.priority ?? NO_PRIORITY;

  const ageAt = (time: number, all: Map<string, ProcessRuntime>) => {
    for (const rt of all.values()) {
      if (rt.state === "NEW" || rt.state === "TERMINATED") continue;
      if (rt.spec.arrivalTime > time || rt.remainingCpu <= 0) continue;
      const last = lastCheck.get(rt.pid) ?? 0;
      const dt = time - last;
      if (dt >= agingInterval) {
        const steps = Math.floor(dt / agingInterval);
        const current = effective.get(rt.pid) ?? rt.spec.priority ?? NO_PRIORITY;
        effective.set(rt.pid, Math.max(0, current - steps * agingAmount));
        lastCheck.set(rt.pid, time);
      }
    }
  };

  return {
    id: "priorityAging",
    name: "Priority + Aging",
    onProcessArrival: seed,
    onProcessReady: seed,
    onProcessRun(_rt, duration, context) {
      // Age at dispatch (selectNext already aged); schedule interrupts for waiting processes
      for (const p of context.ready) {
        seed(p);
        const last = lastCheck.get(p.pid) ?? 0;
        const next = last + agingInterval;
        if (next > context.time && next < context.time + duration && !scheduledTicks.has(next)) {
          scheduledTicks.add(next);
          context.schedule(next, "AGING_TICK");
        }
      }
    },
    selectNext(candidates, context) {
      ageAt(context.time, context.all);
      for (const c of candidates) seed(c);
      return pickBest(candidates, effPriority);
    },
  };
}

export function multiLevelQueuePolicy(
  queues: { name: string; priorityRange?: { min: number; max: number } }[]
): SchedulerPolicy {
  return {
    id: "multiLevelQueue",
    name: "Multilevel Queue",
    selectNext(candidates) {
      if (candidates.length === 0) return null;
      const buckets: ProcessRuntime[][] = queues.map(() => []);
      for (const c of candidates) {
        const pri = c.spec.priority ?? NO_PRIORITY;
        let idx = queues.length - 1;
        for (let i = 0; i < queues.length; i++) {
          const range = queues[i].priorityRange;
          if (!range) {
            idx = i;
            break;
          }
          if (pri >= range.min && pri <= range.max) {
            idx = i;
            break;
          }
        }
        buckets[idx].push(c);
      }
      for (const bucket of buckets) {
        if (bucket.length > 0) return bucket[0];
      }
      return null;
    },
  };
}

export function multiLevelFeedbackPolicy(
  quantumPerLevel: number[],
  agingPromotionInterval: number,
  demotionThreshold: number
): SchedulerPolicy {
  interface MlfqState {
    level: number;
    timesSliced: number;
    lastServed: number;
  }
  const state = new Map<string, MlfqState>();

  const st = (rt: ProcessRuntime): MlfqState => {
    let s = state.get(rt.pid);
    if (!s) {
      s = { level: 0, timesSliced: 0, lastServed: -rt.spec.arrivalTime };
      state.set(rt.pid, s);
    }
    return s;
  };

  return {
    id: "multiLevelFeedback",
    name: "MLFQ",
    ignoreQuantumWhenAlone: false,
    quantumFor(rt) {
      const level = st(rt).level;
      return quantumPerLevel[Math.min(level, quantumPerLevel.length - 1)];
    },
    onProcessArrival: st,
    onProcessReady: st,
    selectNext(candidates, context) {
      if (candidates.length === 0) return null;
      for (const c of candidates) {
        const s = st(c);
        while (s.level > 0 && context.time - s.lastServed >= agingPromotionInterval) {
          s.level -= 1;
        }
      }
      let bestLevel = Infinity;
      for (const c of candidates) {
        const level = st(c).level;
        if (level < bestLevel) bestLevel = level;
      }
      for (const c of candidates) {
        if (st(c).level === bestLevel) return c;
      }
      return null;
    },
    onProcessStop(rt, reason, context) {
      if (reason === "COMPLETED") {
        state.delete(rt.pid);
        return;
      }
      const s = st(rt);
      s.timesSliced += 1;
      s.lastServed = context.time;
      if (s.timesSliced >= demotionThreshold && s.level < quantumPerLevel.length - 1) {
        s.level += 1;
        s.timesSliced = 0;
      }
    },
  };
}
