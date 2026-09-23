import { AlgorithmType, Process, SimulationResult } from '../types';
import { ALGORITHMS } from './Header';
import { RULES } from '../utils/explain';

export interface LessonCard {
  id: string;
  title: string;
  body: string;
  tip?: string;
}

export function buildLessons(algorithm: AlgorithmType): LessonCard[] {
  const meta = ALGORITHMS.find((a) => a.id === algorithm);
  const rule = RULES[algorithm] ?? algorithm;
  return [
    {
      id: `${algorithm}-rule`,
      title: meta?.name ?? algorithm,
      body: rule,
      tip: meta?.isPreemptive ? 'Preemptive: can interrupt the running process.' : 'Non-preemptive: runs until completion or block.',
    },
    {
      id: `${algorithm}-complexity`,
      title: 'When to use it',
      body: whenToUse(algorithm),
    },
    {
      id: `${algorithm}-tradeoff`,
      title: 'Trade-off',
      body: tradeoff(algorithm),
    },
  ];
}

function whenToUse(a: AlgorithmType): string {
  switch (a) {
    case 'fifo':
      return 'Simple batch systems where fairness by arrival is enough.';
    case 'sjf':
      return 'Known burst times; minimizes average waiting when estimates are accurate.';
    case 'srtf':
      return 'Interactive workloads with variable remaining times.';
    case 'roundRobin':
      return 'Time-sharing systems needing responsive average response time.';
    case 'priorityNonPreemptive':
    case 'priorityPreemptive':
      return 'Class-based systems (system vs user processes).';
    case 'priorityAging':
      return 'Priority systems that must still prevent starvation.';
    case 'multiLevelQueue':
      return 'Stable process classes with fixed priority bands.';
    case 'multiLevelFeedback':
      return 'Unknown burst lengths; adapt quantum to observed behavior.';
    case 'hrrn':
      return 'Non-preemptive fairness balancing wait vs service.';
    case 'lrtf':
      return 'Workloads where long jobs should finish first (rare in practice).';
    case 'lottery':
      return 'Proportional share with soft real-time fairness guarantees.';
    case 'stride':
      return 'Deterministic proportional share (unlike lottery).';
    case 'wfq':
      return 'Fairness across flows with weights (network/CPU hybrid).';
    case 'edf':
      return 'Dynamic priorities when deadlines are known and feasible.';
    case 'rms':
      return 'Fixed-priority periodic tasks (rate-monotonic is optimal static).';
    case 'adaptive':
      return 'Mixed workloads where RR quantum needs auto-tuning.';
    default:
      return 'General purpose teaching and comparison.';
  }
}

function tradeoff(a: AlgorithmType): string {
  switch (a) {
    case 'fifo':
      return 'Convoy effect: short jobs wait behind a long one.';
    case 'sjf':
      return 'Requires accurate burst estimates; can starve long jobs.';
    case 'srtf':
      return 'High preemption overhead if estimates thrash.';
    case 'roundRobin':
      return 'Too small a quantum → context-switch storm; too large → FCFS.';
    case 'priorityNonPreemptive':
    case 'priorityPreemptive':
      return 'Indefinite starvation of low-priority processes without aging.';
    case 'priorityAging':
      return 'Aging interval tuning; extra bookkeeping.';
    case 'multiLevelQueue':
      return 'No feedback across queues — batch can starve if system queue busy.';
    case 'multiLevelFeedback':
      return 'More complex; quantum/demotion parameters need tuning.';
    case 'hrrn':
      return 'Needs total burst; non-preemptive so poor response for late shorts.';
    case 'lrtf':
      return 'Starves short jobs; thrashing under equal remaining times.';
    case 'lottery':
      return 'Probabilistic — short-run unfairness; needs ticket assignment.';
    case 'stride':
      return 'Weight assignment still manual; pass values need care.';
    case 'wfq':
      return 'Virtual time bookkeeping cost.';
    case 'edf':
      return 'Overload → cascading misses; no static priority fallback.';
    case 'rms':
      return 'Only optimal if utilization ≤ n(2^{1/n}−1); else may miss deadlines.';
    case 'adaptive':
      return 'Heuristic quantum; harder to reason about deterministically.';
    default:
      return 'See algorithm documentation.';
  }
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explain: string;
}

export function buildQuiz(seed = 1): QuizQuestion[] {
  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      prompt: 'Which algorithm minimizes average waiting time if burst times are known exactly?',
      choices: ['FCFS', 'SJF', 'Round Robin', 'Priority'],
      correctIndex: 1,
      explain: 'SJF is provably optimal for average waiting time given known bursts.',
    },
    {
      id: 'q2',
      prompt: 'Round Robin with a very small quantum primarily causes:',
      choices: ['Starvation of short jobs', 'Excess context switches', 'Convoy effect', 'Deadline misses'],
      correctIndex: 1,
      explain: 'Tiny quanta rotate constantly → high context-switch overhead.',
    },
    {
      id: 'q3',
      prompt: 'Aging in priority scheduling is used to:',
      choices: ['Increase burst times', 'Prevent starvation of low-priority jobs', 'Reduce quantum', 'Improve throughput only'],
      correctIndex: 1,
      explain: 'Waiting raises effective priority so low-priority jobs eventually run.',
    },
    {
      id: 'q4',
      prompt: 'EDF is a ____ priority algorithm; RMS is ____.',
      choices: ['static, dynamic', 'dynamic, static', 'FIFO, LIFO', 'non-preemptive, preemptive'],
      correctIndex: 1,
      explain: 'EDF priorities change with absolute deadlines; RMS uses fixed period order.',
    },
    {
      id: 'q5',
      prompt: 'Lottery scheduling selects the next process by:',
      choices: ['Shortest remaining time', 'Random draw weighted by tickets', 'Earliest deadline', 'Lowest pass value'],
      correctIndex: 1,
      explain: 'Tickets determine selection probability; stride uses deterministic passes.',
    },
    {
      id: 'q6',
      prompt: 'The convoy effect is most associated with:',
      choices: ['Round Robin', 'FCFS', 'MLFQ', 'Stride'],
      correctIndex: 1,
      explain: 'A long CPU-bound job first blocks short jobs behind it in FCFS.',
    },
    {
      id: 'q7',
      prompt: 'Jain’s fairness index of 1.0 means:',
      choices: ['Perfectly equal service', 'Zero throughput', 'Maximum context switches', 'No ready processes'],
      correctIndex: 0,
      explain: 'Jain’s index = 1 when all flows receive identical share.',
    },
    {
      id: 'q8',
      prompt: 'Which is NOT a valid process state in this lab?',
      choices: ['BLOCKED', 'RUNNING', 'ZOMBIE', 'READY'],
      correctIndex: 2,
      explain: 'States are NEW/READY/RUNNING/BLOCKED/TERMINATED (no ZOMBIE).',
    },
  ];
  // Stable shuffle by seed
  const order = [...questions];
  let s = seed >>> 0 || 1;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export interface ScenarioInsight {
  label: string;
  value: string;
}

export function scenarioInsights(
  result: SimulationResult,
  processes: Process[],
  algorithm: AlgorithmType
): ScenarioInsight[] {
  const m = result.metrics;
  const insight: ScenarioInsight[] = [
    { label: 'Algorithm', value: ALGORITHMS.find((a) => a.id === algorithm)?.name ?? algorithm },
    { label: 'Processes', value: String(processes.length) },
    { label: 'Avg wait', value: `${result.averageWaitingTime.toFixed(2)} ms` },
  ];
  if (m) {
    insight.push({ label: 'Fairness', value: m.jainFairness.toFixed(3) });
    insight.push({ label: 'CS count', value: String(m.contextSwitchCount) });
    if (m.deadlineMisses > 0) insight.push({ label: 'Deadline misses', value: String(m.deadlineMisses) });
  }
  return insight;
}
