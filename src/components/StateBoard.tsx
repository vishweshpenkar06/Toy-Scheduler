import { Process, TimelineSlice } from '../types';
import { buildColorMap } from '../utils/chartUtils';

interface StateBoardProps {
  timeline: TimelineSlice[];
  processes: Process[];
  currentTimeStep: number;
}

type BoardState = 'ARRIVED' | 'READY' | 'RUNNING' | 'BLOCKED' | 'FINISHED';

const STATE_STYLES: Record<BoardState, { bg: string; fg: string }> = {
  RUNNING: { bg: 'rgba(16, 185, 129, 0.16)', fg: '#10b981' },
  BLOCKED: { bg: 'rgba(245, 158, 11, 0.16)', fg: '#f59e0b' },
  READY: { bg: 'rgba(37, 99, 235, 0.14)', fg: '#2563eb' },
  FINISHED: { bg: 'rgba(139, 147, 161, 0.14)', fg: 'var(--text-3)' },
  ARRIVED: { bg: 'rgba(139, 147, 161, 0.14)', fg: 'var(--text-3)' },
};

function stateAt(timeline: TimelineSlice[], pid: string, t: number): BoardState {
  const slices = timeline.filter((s) => s.pid === pid);
  if (slices.length === 0) return 'ARRIVED';

  const running = slices.some((s) => s.kind === 'EXECUTION' && t >= s.start && t < s.end);
  if (running) return 'RUNNING';

  const blocked = slices.some((s) => s.kind === 'IO' && t >= s.start && t < s.end);
  if (blocked) return 'BLOCKED';

  const lastEnd = Math.max(...slices.filter((s) => s.kind !== 'IO').map((s) => s.end), 0);
  const execSlices = slices.filter((s) => s.kind === 'EXECUTION');
  const lastExecEnd = execSlices.length > 0 ? Math.max(...execSlices.map((s) => s.end)) : 0;
  if (execSlices.length > 0 && t >= lastExecEnd && !slices.some((s) => s.kind === 'EXECUTION' && s.start > t)) {
    return 'FINISHED';
  }

  const firstArrival = Math.min(...slices.map((s) => s.start));
  if (t < firstArrival) return 'ARRIVED';
  if (lastEnd <= t && execSlices.length === 0) return 'ARRIVED';
  return 'READY';
}

export const StateBoard = ({ timeline, processes, currentTimeStep }: StateBoardProps) => {
  if (processes.length === 0) return null;
  const colorMap = buildColorMap(processes);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Process states</div>
          <div className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>
            t = {currentTimeStep} ms
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="state-board">
          {processes.map((p) => {
            const state = stateAt(timeline, p.pid, currentTimeStep);
            const style = STATE_STYLES[state];
            return (
              <div
                key={p.pid}
                className="state-chip"
                style={{ background: style.bg, color: style.fg, borderColor: style.fg }}
              >
                <span className="state-pid" style={{ color: colorMap[p.pid] }}>
                  {p.pid}
                </span>
                <span className="state-label">{state}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
