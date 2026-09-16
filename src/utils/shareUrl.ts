import { Process, AlgorithmType } from '../types';
import { validateProcessInput } from '../engine/scheduler';

const VALID_ALGORITHMS: ReadonlySet<string> = new Set<AlgorithmType>([
  'fifo', 'sjf', 'srtf', 'roundRobin',
  'priorityNonPreemptive', 'priorityPreemptive',
  'priorityAging', 'multiLevelQueue', 'multiLevelFeedback',
]);

const MAX_PROCESSES = 20;
const SCHEMA_VERSION = 1;

interface ShareableState {
  processes: Process[];
  algorithm: AlgorithmType;
  quantum: number;
  coreCount: number;
}

export function encodeStateToURL(state: ShareableState): string | null {
  const data = {
    v: SCHEMA_VERSION,
    p: state.processes.map((proc) => ({
      pid: proc.pid,
      arr: proc.arrivalTime,
      burst: proc.burstTime,
      pri: proc.priority,
      color: proc.color,
    })),
    alg: state.algorithm,
    q: state.quantum,
    cores: state.coreCount,
  };

  const json = JSON.stringify(data);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  const url = new URL(window.location.href);
  url.searchParams.set('s', encoded);

  // Browser practical limit for URL sharing is ~2000 chars
  if (url.toString().length > 2000) return null;

  return url.toString();
}

export function decodeStateFromURL(): ShareableState | null {
  const url = new URL(window.location.href);
  const param = url.searchParams.get('s');
  if (!param) return null;

  try {
    const json = decodeURIComponent(escape(atob(param)));
    const data = JSON.parse(json);

    if (!data || typeof data !== 'object') return null;

    // Schema version check
    if (data.v !== SCHEMA_VERSION) return null;

    if (!data.p || !Array.isArray(data.p)) return null;

    // Cap process count
    const rawProcesses = data.p.slice(0, MAX_PROCESSES);

    const processes: Process[] = rawProcesses.map((p: Record<string, unknown>) => ({
      pid: String(p.pid || 'P1'),
      arrivalTime: typeof p.arr === 'number' ? p.arr : 0,
      burstTime: typeof p.burst === 'number' ? p.burst : 1,
      priority: p.pri != null && typeof p.pri === 'number' ? p.pri : undefined,
      color: p.color ? String(p.color) : undefined,
    }));

    // Validate every decoded process
    for (const p of processes) {
      const err = validateProcessInput(p);
      if (err) return null;
    }

    // Validate algorithm
    const algorithm = typeof data.alg === 'string' && VALID_ALGORITHMS.has(data.alg)
      ? (data.alg as AlgorithmType)
      : 'fifo';

    // Validate quantum and core count
    const quantum = Number.isFinite(data.q) && Number.isInteger(data.q) && data.q > 0 ? data.q : 2;
    const coreCount = Number.isFinite(data.cores) && Number.isInteger(data.cores) && data.cores >= 1 && data.cores <= 4 ? data.cores : 1;

    return { processes, algorithm, quantum, coreCount };
  } catch {
    return null;
  }
}

export function clearURLParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  window.history.replaceState({}, '', url.toString());
}
