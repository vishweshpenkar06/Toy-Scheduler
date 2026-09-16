import { TimelineSlice, Process } from '../types';

interface ReadyQueueHudProps {
  timeline: TimelineSlice[];
  processes: Process[];
  currentTimeStep: number;
}

export const ReadyQueueHud: React.FC<ReadyQueueHudProps> = ({ timeline, processes, currentTimeStep }) => {
  const activeSlice = timeline.find((s) => currentTimeStep >= s.start && currentTimeStep < s.end);
  const runningPid = activeSlice && activeSlice.pid !== 'idle' ? activeSlice.pid : null;

  const completionMap = new Map<string, number>();
  timeline.forEach((s) => {
    if (s.pid !== 'idle') {
      completionMap.set(s.pid, Math.max(completionMap.get(s.pid) ?? 0, s.end));
    }
  });

  const ready: Process[] = [];
  const completed: Process[] = [];
  processes.forEach((p) => {
    const comp = completionMap.get(p.pid) ?? 0;
    if (currentTimeStep >= comp && comp > 0) completed.push(p);
    else if (p.arrivalTime <= currentTimeStep && p.pid !== runningPid) ready.push(p);
  });

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Queue state</div>
        <span className="card-count">t = {currentTimeStep}</span>
      </div>
      <div className="card-body queue-card">
        <div className="queue-row">
          <div className="queue-label">
            Ready
            <span className="queue-count">{ready.length}</span>
          </div>
          <div className="chips">
            {ready.length === 0 ? (
              <span className="queue-empty">Queue empty</span>
            ) : (
              ready.map((p) => (
                <span key={p.pid} className="chip">
                  <span className="chip-dot" style={{ background: p.color ?? '#2154f0' }} />
                  {p.pid} <span className="muted" style={{ fontFamily: 'inherit', fontSize: 10.5 }}>(arr {p.arrivalTime})</span>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="queue-row">
          <div className="queue-label">
            Completed
            <span className="queue-count">{completed.length}/{processes.length}</span>
          </div>
          <div className="chips">
            {completed.length === 0 ? (
              <span className="queue-empty">None yet</span>
            ) : (
              completed.map((p) => (
                <span key={p.pid} className="chip ok">
                  {p.pid}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};