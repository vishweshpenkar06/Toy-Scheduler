import { Process, AlgorithmType } from '../types';

const KEY = 'toy-scheduler-session-v1';

export interface PersistedSession {
  processes: Process[];
  algorithm: AlgorithmType;
  quantum: number;
  coreCount: number;
  contextSwitchCost: number;
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.processes)) return null;
    return {
      processes: data.processes.slice(0, 50),
      algorithm: data.algorithm ?? 'fifo',
      quantum: Number.isInteger(data.quantum) && data.quantum > 0 ? data.quantum : 2,
      coreCount: Number.isInteger(data.coreCount) && data.coreCount >= 1 && data.coreCount <= 4 ? data.coreCount : 1,
      contextSwitchCost: Number.isFinite(data.contextSwitchCost) && data.contextSwitchCost >= 0 ? data.contextSwitchCost : 0,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* quota or private mode */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
