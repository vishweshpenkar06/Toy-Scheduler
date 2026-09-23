import { describe, it, expect } from 'vitest';
import { buildLessons, buildQuiz, scenarioInsights } from '../learningContent';
import { buildReportMarkdown, buildResultsCsv } from '../../utils/report';
import { loadSession, saveSession, clearSession } from '../../utils/persistence';

describe('learning content', () => {
  it('builds three lessons for every algorithm id', () => {
    const ids = [
      'fifo', 'sjf', 'srtf', 'roundRobin', 'priorityNonPreemptive', 'priorityPreemptive',
      'priorityAging', 'multiLevelQueue', 'multiLevelFeedback', 'hrrn', 'lrtf', 'lottery',
      'stride', 'wfq', 'edf', 'rms', 'adaptive',
    ] as const;
    for (const id of ids) {
      const lessons = buildLessons(id);
      expect(lessons).toHaveLength(3);
      expect(lessons[0].body.length).toBeGreaterThan(10);
    }
  });

  it('quiz has 8 unique questions with valid answers', () => {
    const qs = buildQuiz(1);
    expect(qs).toHaveLength(8);
    expect(new Set(qs.map((q) => q.id)).size).toBe(8);
    for (const q of qs) {
      expect(q.choices).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
    }
  });

  it('quiz shuffles stably for a seed', () => {
    expect(buildQuiz(5)).toEqual(buildQuiz(5));
  });

  it('scenarioInsights includes algorithm name', () => {
    const insights = scenarioInsights(
      { timeline: [], processResults: [], averageWaitingTime: 1, averageTurnaroundTime: 2, averageResponseTime: 0.5 },
      [{ pid: 'P1', arrivalTime: 0, burstTime: 3 }],
      'roundRobin'
    );
    expect(insights[0].value).toBe('Round Robin');
  });
});

describe('report', () => {
  const result = {
    timeline: [{ pid: 'P1', start: 0, end: 5 }],
    processResults: [{ pid: 'P1', waitingTime: 1, turnaroundTime: 5, responseTime: 0, completionTime: 5, contextSwitches: 2, deadlineMiss: false }],
    averageWaitingTime: 1,
    averageTurnaroundTime: 5,
    averageResponseTime: 0,
    metrics: {
      throughput: 0.2, cpuUtilization: 80, contextSwitchCount: 2, jainFairness: 1,
      waitingP50: 1, waitingP95: 1, deadlineMisses: 0,
    },
  };

  it('markdown includes config and table', () => {
    const md = buildReportMarkdown({
      processes: [{ pid: 'P1', arrivalTime: 0, burstTime: 4, deadline: 10 }],
      algorithm: 'edf',
      quantum: 2,
      coreCount: 1,
      contextSwitchCost: 1,
      result,
    });
    expect(md).toContain('# Quantum Scheduler Report');
    expect(md).toContain('EDF');
    expect(md).toContain('| P1 |');
    expect(md).toContain('Jain fairness');
  });

  it('csv has header + rows', () => {
    const csv = buildResultsCsv(result);
    expect(csv.split('\n')[0]).toContain('pid');
    expect(csv).toContain('P1,1,5');
  });
});

describe('persistence', () => {
  it('round-trips a session', () => {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
    clearSession();
    expect(loadSession()).toBeNull();
    saveSession({
      processes: [{ pid: 'A', arrivalTime: 0, burstTime: 3 }],
      algorithm: 'sjf',
      quantum: 4,
      coreCount: 2,
      contextSwitchCost: 1,
    });
    const loaded = loadSession();
    expect(loaded?.algorithm).toBe('sjf');
    expect(loaded?.quantum).toBe(4);
    expect(loaded?.coreCount).toBe(2);
    clearSession();
    expect(loadSession()).toBeNull();
    delete (globalThis as Record<string, unknown>).localStorage;
  });
});
