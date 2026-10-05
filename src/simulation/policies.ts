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
  const nextTick = new Map<string, number>();

  const seed = (rt: ProcessRuntime) => {
    if (!effective.has(rt.pid)) {
      effective.set(rt.pid, rt.spec.priority ?? NO_PRIORITY);
      lastCheck.set(rt.pid, rt.spec.arrivalTime);
    }
  };

  const effPriority = (rt: ProcessRuntime) =>
    effective.get(rt.pid) ?? rt.spec.priority ?? NO_PRIORITY;

  const ageAt = (time: number, processes: Iterable<ProcessRuntime>) => {
    for (const rt of processes) {
      if (rt.state === "NEW" || rt.state === "TERMINATED") continue;
      if (rt.spec.arrivalTime > time) continue;
      seed(rt);
      const last = lastCheck.get(rt.pid) ?? rt.spec.arrivalTime;
      const dt = time - last;
      if (dt >= agingInterval) {
        const steps = Math.floor(dt / agingInterval);
        const current = effective.get(rt.pid) ?? rt.spec.priority ?? NO_PRIORITY;
        effective.set(rt.pid, Math.max(0, current - steps * agingAmount));
        lastCheck.set(rt.pid, last + steps * agingInterval);
      }
    }
  };

  return {
    id: "priorityAging",
    name: "Priority + Aging",
    onProcessArrival: seed,
    onProcessReady: seed,
    onProcessRun(_rt, duration, context) {
      const end = context.time + duration;
      for (const p of context.ready) {
        seed(p);
        const due = (lastCheck.get(p.pid) ?? p.spec.arrivalTime) + agingInterval;
        const at = Math.min(Math.max(due, context.time + 1), end - 1);
        if (at > context.time && nextTick.get(p.pid) !== at) {
          nextTick.set(p.pid, at);
          context.schedule(at, "AGING_TICK");
        }
      }
    },
    // Preemption happens at the aging tick via kernel re-selection, not on
    // arrival: aging raises a waiter's priority over the incumbent, and the
    // tick is the point where that is re-evaluated.
    selectNext(candidates, context) {
      ageAt(context.time, candidates);
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

function responseRatio(rt: ProcessRuntime, now: number): number {
  const service = totalBurst(rt);
  const waiting = Math.max(0, now - rt.spec.arrivalTime - (service - rt.remainingCpu));
  return (waiting + service) / Math.max(service, 1);
}

export const hrrnPolicy: SchedulerPolicy = {
  id: "hrrn",
  name: "Highest Response Ratio Next",
  selectNext(candidates, context) {
    return pickBest(candidates, (rt) => -responseRatio(rt, context.time));
  },
};

export const lrtfPolicy: SchedulerPolicy = {
  id: "lrtf",
  name: "Longest Remaining Time First",
  selectNext(candidates) {
    return pickBest(candidates, (rt) => -rt.remainingCpu);
  },
  // LRTF wants the longest job running, so the victim of a preemption is the
  // running process with the SHORTEST remaining time (opposite of SRTF).
  victimScore: (rt) => -rt.remainingCpu,
  shouldPreempt(running, candidates) {
    const best = pickBest(candidates, (rt) => -rt.remainingCpu);
    if (!best) return false;
    if (best.remainingCpu > running.remainingCpu) return true;
    return best.remainingCpu === running.remainingCpu && best.pid.localeCompare(running.pid) < 0;
  },
};

export function lotteryPolicy(): SchedulerPolicy {
  return {
    id: "lottery",
    name: "Lottery Scheduling",
    selectNext(candidates, context) {
      if (candidates.length === 0) return null;
      const tickets = candidates.map((c) => Math.max(1, c.spec.tickets ?? c.spec.weight ?? 1));
      const total = tickets.reduce((s, t) => s + t, 0);
      let draw = context.random() * total;
      for (let i = 0; i < candidates.length; i++) {
        draw -= tickets[i];
        if (draw < 0) return candidates[i];
      }
      return candidates[candidates.length - 1];
    },
  };
}

const STRIDE_SCALE = 100000;

function weightOf(rt: ProcessRuntime): number {
  return Math.max(1, rt.spec.weight ?? rt.spec.tickets ?? 1);
}

/**
 * Stride scheduling: every process owns a pass counter. The one with the
 * lowest pass runs, and is charged one stride (STRIDE_SCALE / weight) for the
 * turn it just took. A lighter process therefore pays more per turn and wins
 * proportionally fewer turns. Built per run so the counters cannot leak
 * between simulations.
 */
export function stridePolicy(quantum = 1): SchedulerPolicy {
  const pass = new Map<string, number>();

  return {
    id: "stride",
    name: "Stride Scheduling",
    quantum,
    ignoreQuantumWhenAlone: true,
    onProcessArrival(rt) {
      // A newcomer lines up beside whoever is currently least served rather
      // than behind everyone, so it neither jumps the queue nor starves.
      if (!pass.has(rt.pid)) pass.set(rt.pid, pass.size ? Math.min(...pass.values()) : 0);
    },
    selectNext(candidates) {
      return pickBest(candidates, (rt) => pass.get(rt.pid) ?? 0);
    },
    onProcessRun(rt) {
      pass.set(rt.pid, (pass.get(rt.pid) ?? 0) + STRIDE_SCALE / weightOf(rt));
    },
    // The process that has run most recently holds the highest pass, so it
    // is the one that deserves to yield.
    victimScore: (rt) => pass.get(rt.pid) ?? 0,
    onProcessStop(rt, reason) {
      if (reason === "COMPLETED") pass.delete(rt.pid);
    },
  };
}

/**
 * Weighted Fair Queuing: each process carries a virtual finish tag. The one
 * with the lowest tag runs and its tag is pushed forward by the service it
 * consumed divided by its weight, so a heavy-weight tag climbs slowly and
 * keeps winning turns. A newcomer starts at the current virtual time (the
 * lowest tag in circulation), which is what makes it fair rather than FIFO.
 */
export function wfqPolicy(quantum = 1): SchedulerPolicy {
  const finishTag = new Map<string, number>();
  const startedAt = new Map<string, number>();
  const virtualNow = () => (finishTag.size ? Math.min(...finishTag.values()) : 0);
  const tagOf = (rt: ProcessRuntime) => finishTag.get(rt.pid) ?? 0;

  return {
    id: "wfq",
    name: "Weighted Fair Queuing",
    quantum,
    ignoreQuantumWhenAlone: true,
    onProcessArrival(rt) {
      if (!finishTag.has(rt.pid)) finishTag.set(rt.pid, virtualNow());
    },
    selectNext(candidates) {
      return pickBest(candidates, tagOf);
    },
    shouldPreempt(running, candidates) {
      const best = pickBest(candidates, tagOf);
      return best !== null && tagOf(best) < tagOf(running);
    },
    // The process with the highest tag has been served the most for its
    // weight, so it is the one that should be displaced.
    victimScore: tagOf,
    onProcessRun(rt, _duration, context) {
      if (!finishTag.has(rt.pid)) finishTag.set(rt.pid, virtualNow());
      startedAt.set(rt.pid, context.time);
    },
    onProcessStop(rt, reason, context) {
      const served = Math.max(0, context.time - (startedAt.get(rt.pid) ?? context.time));
      startedAt.delete(rt.pid);
      finishTag.set(rt.pid, tagOf(rt) + served / weightOf(rt));
      if (reason === "COMPLETED") finishTag.delete(rt.pid);
    },
  };
}

export const edfPolicy: SchedulerPolicy = {
  id: "edf",
  name: "Earliest Deadline First",
  selectNext(candidates) {
    return pickBest(candidates, (rt) => rt.spec.deadline ?? Number.MAX_SAFE_INTEGER);
  },
  shouldPreempt(running, candidates) {
    const best = pickBest(candidates, (rt) => rt.spec.deadline ?? Number.MAX_SAFE_INTEGER);
    if (!best) return false;
    const rd = best.spec.deadline ?? Number.MAX_SAFE_INTEGER;
    const nd = running.spec.deadline ?? Number.MAX_SAFE_INTEGER;
    if (rd < nd) return true;
    return rd === nd && best.pid.localeCompare(running.pid) < 0;
  },
};

export const rmsPolicy: SchedulerPolicy = {
  id: "rms",
  name: "Rate Monotonic",
  selectNext(candidates) {
    // lower period = higher priority (static)
    return pickBest(candidates, (rt) => rt.spec.period ?? Number.MAX_SAFE_INTEGER);
  },
  shouldPreempt(running, candidates) {
    const best = pickBest(candidates, (rt) => rt.spec.period ?? Number.MAX_SAFE_INTEGER);
    if (!best) return false;
    const bp = best.spec.period ?? Number.MAX_SAFE_INTEGER;
    const rp = running.spec.period ?? Number.MAX_SAFE_INTEGER;
    if (bp < rp) return true;
    return bp === rp && best.pid.localeCompare(running.pid) < 0;
  },
};

export function adaptivePolicy(quantum: number): SchedulerPolicy {
  const quantumOf = new Map<string, number>();
  const q = (rt: ProcessRuntime) => quantumOf.get(rt.pid) ?? quantum;

  return {
    id: "adaptive",
    name: "Adaptive Quantum RR",
    quantum,
    ignoreQuantumWhenAlone: true,
    yieldWhenAloneOnArrival: true,
    quantumFor: q,
    onProcessRun(rt, _duration, context) {
      // Waited longer than its own slice while competitors queued: widen it back.
      const waited = context.time - (rt.readySince ?? rt.spec.arrivalTime);
      if (context.ready.length > 0 && waited > q(rt)) {
        quantumOf.set(rt.pid, Math.min(quantum, q(rt) * 2));
      }
    },
    onProcessStop(rt, reason, context) {
      if (reason === "COMPLETED") {
        quantumOf.delete(rt.pid);
        return;
      }
      // Burned a whole slice with competitors waiting: narrow its slice.
      if (reason === "QUANTUM_EXPIRED" && context.ready.length > 0) {
        quantumOf.set(rt.pid, Math.max(1, Math.floor(q(rt) / 2)));
      }
    },
    selectNext(candidates, context) {
      if (candidates.length === 0) return null;
      // prefer longest-waiting (anti-starvation) among arrived
      return pickBest(candidates, (rt) => -(context.time - (rt.readySince ?? rt.spec.arrivalTime)));
    },
  };
}
