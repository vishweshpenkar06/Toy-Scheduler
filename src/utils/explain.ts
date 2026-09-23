import { Process, TimelineSlice, DecisionEntry, AlgorithmType } from "../types";
import { DecisionExplanation, CandidateExplanation } from "../domain/models";

export const RULES: Record<string, string> = {
  fifo: "First-come first-served: earliest arrival runs next.",
  sjf: "Shortest job first: smallest total burst runs next.",
  srtf: "Shortest remaining time first: preempts when a shorter job arrives.",
  roundRobin: "Round robin: fixed quantum, then rotate to queue tail.",
  priorityNonPreemptive: "Priority (non-preemptive): highest priority runs to completion.",
  priorityPreemptive: "Priority (preemptive): higher priority arrival preempts current.",
  priorityAging: "Priority with aging: waiting raises effective priority over time.",
  multiLevelQueue: "Multilevel queue: strict queue-level priority, FIFO within queue.",
  multiLevelFeedback: "MLFQ: quantum per level; demote on exhaustion, promote on wait.",
  hrrn: "Highest response ratio next: (wait + service) / service is maximized.",
  lrtf: "Longest remaining time first: largest remaining CPU runs/preempts.",
  lottery: "Lottery: winner drawn proportional to ticket count.",
  stride: "Stride: smallest virtual pass value (weight-proportional) runs next.",
  wfq: "Weighted fair queuing: lowest virtual finish tag runs next.",
  edf: "Earliest deadline first: soonest absolute deadline runs next.",
  rms: "Rate monotonic: shortest period (static highest priority) runs next.",
  adaptive: "Adaptive RR: anti-starvation wait ordering with shrinking quantum.",
};

export function generateDecisionLog(
  timeline: TimelineSlice[],
  processes: Process[],
  algorithm: string
): DecisionEntry[] {
  if (timeline.length === 0) return [];
  const log: DecisionEntry[] = [];
  const processMap = new Map<string, Process>();
  processes.forEach((p) => processMap.set(p.pid, p));

  for (let i = 0; i < timeline.length; i++) {
    const slice = timeline[i];
    if (slice.kind === "CONTEXT_SWITCH") {
      log.push({
        time: slice.start,
        message: `t=${slice.start}: context switch on core ${slice.core ?? 0} (${slice.end - slice.start}ms overhead)`,
      });
      continue;
    }
    if (slice.pid === "idle") {
      log.push({
        time: slice.start,
        message: `t=${slice.start}: CPU idle — no processes available`,
      });
      continue;
    }

    const proc = processMap.get(slice.pid);
    const duration = slice.end - slice.start;
    const nextSlice = timeline[i + 1];

    switch (algorithm) {
      case "fifo":
        if (slice.start === proc?.arrivalTime) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} arrives and is first in the FCFS queue, runs for ${duration}ms`,
          });
        } else if (nextSlice && nextSlice.pid !== "idle" && nextSlice.pid !== slice.pid) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs to completion (${duration}ms), then ${nextSlice.pid} goes next`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
          });
        }
        break;

      case "sjf":
        if (nextSlice && nextSlice.pid !== slice.pid) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} is shortest job (${proc?.burstTime}ms burst), runs to completion`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs to completion (${duration}ms)`,
          });
        }
        break;

      case "srtf":
        if (i > 0 && timeline[i - 1].pid !== slice.pid && timeline[i - 1].pid !== "idle") {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} has shorter remaining time, preempts ${timeline[i - 1].pid}`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms (remaining: ${proc ? proc.burstTime - duration : 0}ms)`,
          });
        }
        break;

      case "roundRobin":
        if (nextSlice && nextSlice.pid !== slice.pid && nextSlice.pid !== "idle") {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid}'s quantum expires, rotates to back of queue`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
          });
        }
        break;

      case "priorityNonPreemptive":
      case "priorityPreemptive":
        if (nextSlice && nextSlice.pid !== slice.pid && algorithm === "priorityPreemptive") {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${nextSlice.pid} has higher priority, preempts ${slice.pid}`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} (priority ${proc?.priority ?? "default"}) runs for ${duration}ms`,
          });
        }
        break;

      case "priorityAging":
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} runs ${duration}ms; aging may promote waiting processes`,
        });
        break;

      case "multiLevelQueue":
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} selected from its priority queue, runs ${duration}ms`,
        });
        break;

      case "multiLevelFeedback":
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} uses ${duration}ms slice, may be demoted to lower queue`,
        });
        break;

      default:
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} runs ${duration}ms — ${RULES[algorithm] ?? "scheduled by policy"}`,
        });
    }
  }

  return log;
}

function candidatesFrom(
  algorithm: AlgorithmType,
  ready: { pid: string; burstTime: number; arrivalTime: number; priority?: number; deadline?: number; period?: number; weight?: number }[],
  now: number
): CandidateExplanation[] {
  const score = (p: (typeof ready)[0]): { value: number; label: string } => {
    switch (algorithm) {
      case "fifo":
      case "hrrn":
        if (algorithm === "hrrn") {
          const service = p.burstTime;
          const waiting = Math.max(0, now - p.arrivalTime);
          return { value: (waiting + service) / Math.max(service, 1), label: "response ratio" };
        }
        return { value: p.arrivalTime, label: "arrival" };
      case "sjf":
        return { value: p.burstTime, label: "burst" };
      case "srtf":
        return { value: p.burstTime, label: "remaining (est.)" };
      case "lrtf":
        return { value: -p.burstTime, label: "longest remaining" };
      case "priorityNonPreemptive":
      case "priorityPreemptive":
      case "priorityAging":
        return { value: p.priority ?? Number.MAX_SAFE_INTEGER, label: "priority" };
      case "edf":
        return { value: p.deadline ?? Number.MAX_SAFE_INTEGER, label: "deadline" };
      case "rms":
        return { value: p.period ?? Number.MAX_SAFE_INTEGER, label: "period" };
      case "wfq":
        return { value: -(p.weight ?? 1) / Math.max(p.burstTime, 1), label: "virtual finish" };
      case "stride":
        return { value: now / Math.max(p.weight ?? 1, 1), label: "pass" };
      case "lottery":
        return { value: p.weight ?? 1, label: "tickets" };
      default:
        return { value: now - p.arrivalTime, label: "wait time" };
    }
  };

  return ready.map((p) => {
    const s = score(p);
    return { pid: p.pid, value: s.value, label: s.label };
  });
}

export function buildExplanations(
  algorithm: AlgorithmType,
  timeline: TimelineSlice[],
  processes: Process[]
): DecisionExplanation[] {
  const out: DecisionExplanation[] = [];
  const byPid = new Map(processes.map((p) => [p.pid, p]));
  let decisionId = 0;

  for (const slice of timeline) {
    if (slice.pid === "idle" || slice.kind === "CONTEXT_SWITCH" || slice.kind === "IO") continue;
    const proc = byPid.get(slice.pid);
    if (!proc) continue;
    const others = processes.filter(
      (p) => p.pid !== slice.pid && p.arrivalTime <= slice.start
    );
    const candidates = candidatesFrom(algorithm, others, slice.start);
    // include selected
    const selfScore = candidatesFrom(algorithm, [proc], slice.start)[0];
    const all = [...candidates, selfScore];
    const selected = slice.pid;
    const reason =
      selected === selfScore.pid
        ? `${selfScore.pid} had the best ${selfScore.label} (${selfScore.value})`
        : `${selected} won on ${RULES[algorithm]?.split(":")[0] ?? "policy"} rule`;

    out.push({
      decisionId: `d${decisionId++}`,
      time: slice.start,
      rule: RULES[algorithm] ?? algorithm,
      candidates: all,
      selected,
      reason,
      consequences: [
        `${selected} runs ${slice.end - slice.start}ms on core ${slice.core ?? 0}`,
        `Competing ready jobs at t=${slice.start}: ${others.length}`,
      ],
    });
  }

  return out;
}
