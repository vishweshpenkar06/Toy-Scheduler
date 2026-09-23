import { TimelineSlice, Process } from '../types';

interface CpuMonitorHudProps {
  timeline: TimelineSlice[];
  processes: Process[];
  currentTimeStep: number;
}

export const CpuMonitorHud: React.FC<CpuMonitorHudProps> = ({ timeline, processes, currentTimeStep }) => {
  const activeSlice = timeline.find((s) => currentTimeStep >= s.start && currentTimeStep < s.end);
  const isCs = activeSlice?.kind === 'CONTEXT_SWITCH';
  const isIo = activeSlice?.kind === 'IO';
  const isIdle = !activeSlice || (activeSlice.pid === 'idle' && !isCs);
  const runningPid = activeSlice && activeSlice.pid !== 'idle' && !isIo ? activeSlice.pid : null;
  const runningProcess = processes.find((p) => p.pid === runningPid);

  const totalSpan = timeline.length > 0 ? Math.max(...timeline.map((s) => s.end)) : 0;
  const done = timeline.length > 0 && currentTimeStep >= totalSpan;
  const progress = totalSpan > 0 ? Math.min(100, (currentTimeStep / totalSpan) * 100) : 0;

  const ringClass = done ? 'done' : isIdle || isCs || isIo ? 'idle' : '';
  const color = runningProcess?.color ?? '#2154f0';

  let ringLabel = 'IDLE';
  let main = 'CPU idle';
  let sub = 'Waiting for a ready process…';
  if (isCs && activeSlice) {
    ringLabel = 'CS';
    main = 'Context switch';
    sub = `core ${activeSlice.core ?? 0} · ${activeSlice.start}–${activeSlice.end} ms overhead`;
  } else if (isIo && activeSlice) {
    ringLabel = 'I/O';
    main = `${activeSlice.pid} blocked on I/O`;
    sub = `${activeSlice.start}–${activeSlice.end} ms`;
  } else if (activeSlice && !isIdle && runningPid) {
    ringLabel = runningPid;
    main = `Running ${runningPid}`;
    sub = `${activeSlice.start}–${activeSlice.end} ms · burst ${activeSlice.end - activeSlice.start} ms`;
  } else if (done) {
    main = 'All processes terminated';
    sub = `Simulation complete at t = ${totalSpan} ms`;
  }

  const primaryColor = done ? 'var(--green)' : isIdle && !isCs && !isIo ? 'var(--text-3)' : isCs || isIo ? 'var(--amber, #f59e0b)' : color;

  return (
    <div className="status-bar">
      <div className="status-core">
        <div className={`status-ring ${ringClass}`} style={done || (isIdle && !isCs && !isIo) ? undefined : { background: `${primaryColor}1a`, color: primaryColor }}>
          {ringLabel}
        </div>
        <div className="status-line">
          <span className="status-name" style={{ color: primaryColor }}>{main}</span>
          <span className="status-sub">{sub}</span>
        </div>
      </div>

      <div className="status-right">
        <div className="status-progress">
          <div className="status-progress-fill" style={{ width: `${progress}%`, background: primaryColor }} />
        </div>
        <span className="status-pct">{progress.toFixed(0)}%</span>
      </div>
    </div>
  );
};