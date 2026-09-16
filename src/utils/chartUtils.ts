import { Process } from '../types';

export function niceStep(max: number): number {
  const raw = max / 10;
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export function buildColorMap(processes: Process[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of processes) map[p.pid] = p.color ?? '#2154f0';
  return map;
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
