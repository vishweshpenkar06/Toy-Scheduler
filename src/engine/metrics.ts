import { ExtendedMetrics, ProcessResult, TimelineSlice } from "../types";

export interface ExtendedMetricsInput {
  processResults: ProcessResult[];
  timeline: TimelineSlice[];
  span: number;
  coreCount: number;
  contextSwitchCount: number;
  processCount: number;
  deadlines: number;
  deadlineMisses: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function computeExtendedMetrics(input: ExtendedMetricsInput): ExtendedMetrics {
  const { processResults, timeline, span, coreCount, contextSwitchCount, processCount } = input;

  const busy = timeline
    .filter((s) => s.pid !== "idle" && s.kind !== "CONTEXT_SWITCH" && s.kind !== "IO")
    .reduce((sum, s) => sum + (s.end - s.start), 0);
  const capacity = span * coreCount;
  const cpuUtilization = capacity > 0 ? (busy / capacity) * 100 : 0;
  const throughput = span > 0 ? processCount / span : 0;

  const waits = processResults.map((r) => r.waitingTime).sort((a, b) => a - b);
  const waitingP50 = percentile(waits, 50);
  const waitingP95 = percentile(waits, 95);

  // Jain's fairness on turnaround times (equal turnarounds → fairness 1)
  const turns = processResults.map((r) => r.turnaroundTime);
  const sum = turns.reduce((s, t) => s + t, 0);
  const sumSq = turns.reduce((s, t) => s + t * t, 0);
  const jainFairness = sumSq > 0 ? (sum * sum) / (turns.length * sumSq) : 1;

  return {
    throughput,
    cpuUtilization,
    contextSwitchCount,
    jainFairness,
    waitingP50,
    waitingP95,
    deadlineMisses: input.deadlineMisses,
  };
}
