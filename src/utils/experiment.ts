import { Process, AlgorithmType } from '../types';
import { runAlgorithm } from '../engine/runAlgorithm';
import { ALGORITHMS } from '../components/Header';

export interface ExperimentPoint {
  param: number;
  avgWait: number;
  avgTurnaround: number;
  throughput: number;
  fairness: number;
}

export interface ExperimentSweep {
  algorithm: AlgorithmType;
  metric: 'avgWait' | 'avgTurnaround' | 'throughput' | 'fairness';
  points: ExperimentPoint[];
}

const DEFAULT_QUANTA = [1, 2, 3, 4, 6, 8, 12, 16];

export function sweepQuantum(
  algorithm: AlgorithmType,
  processes: Process[],
  options?: { quanta?: number[]; contextSwitchCost?: number; coreCount?: number }
): ExperimentSweep {
  const quanta = options?.quanta ?? DEFAULT_QUANTA;
  const points: ExperimentPoint[] = quanta.map((q) => {
    const r = runAlgorithm(algorithm, processes, {
      quantum: q,
      contextSwitchCost: options?.contextSwitchCost ?? 0,
      coreCount: options?.coreCount ?? 1,
    });
    return {
      param: q,
      avgWait: r.averageWaitingTime,
      avgTurnaround: r.averageTurnaroundTime,
      throughput: r.metrics?.throughput ?? 0,
      fairness: r.metrics?.jainFairness ?? 1,
    };
  });
  return { algorithm, metric: 'avgWait', points };
}

export function compareAlgorithms(
  processes: Process[],
  options?: { quantum?: number; contextSwitchCost?: number; coreCount?: number }
): Array<{ algorithm: AlgorithmType; name: string; avgWait: number; avgTurnaround: number; throughput: number; fairness: number; cs: number }> {
  return ALGORITHMS.map((a) => {
    const r = runAlgorithm(a.id, processes, {
      quantum: options?.quantum ?? 2,
      contextSwitchCost: options?.contextSwitchCost ?? 0,
      coreCount: options?.coreCount ?? 1,
    });
    return {
      algorithm: a.id,
      name: a.name,
      avgWait: r.averageWaitingTime,
      avgTurnaround: r.averageTurnaroundTime,
      throughput: r.metrics?.throughput ?? 0,
      fairness: r.metrics?.jainFairness ?? 1,
      cs: r.metrics?.contextSwitchCount ?? 0,
    };
  }).sort((x, y) => x.avgWait - y.avgWait);
}
