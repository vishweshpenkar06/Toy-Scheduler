import { Process, AlgorithmType } from '../types';

interface ShareableState {
  processes: Process[];
  algorithm: AlgorithmType;
  quantum: number;
  coreCount: number;
}

export function encodeStateToURL(state: ShareableState): string {
  const data = {
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
  return url.toString();
}

export function decodeStateFromURL(): ShareableState | null {
  const url = new URL(window.location.href);
  const param = url.searchParams.get('s');
  if (!param) return null;

  try {
    const json = decodeURIComponent(escape(atob(param)));
    const data = JSON.parse(json);

    if (!data.p || !Array.isArray(data.p)) return null;

    const processes: Process[] = data.p.map((p: Record<string, unknown>) => ({
      pid: String(p.pid || 'P1'),
      arrivalTime: Number(p.arr) || 0,
      burstTime: Number(p.burst) || 1,
      priority: p.pri != null ? Number(p.pri) : undefined,
      color: p.color ? String(p.color) : undefined,
    }));

    return {
      processes,
      algorithm: (data.alg as AlgorithmType) || 'fifo',
      quantum: Number(data.q) || 2,
      coreCount: Number(data.cores) || 1,
    };
  } catch {
    return null;
  }
}

export function clearURLParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  window.history.replaceState({}, '', url.toString());
}
