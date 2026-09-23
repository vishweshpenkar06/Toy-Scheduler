import { useState } from 'react';
import { TimelineSlice, Process } from '../types';
import { niceStep, buildColorMap } from '../utils/chartUtils';

interface GanttChartProps {
  timeline: TimelineSlice[];
  processes: Process[];
  currentTimeStep: number;
  coreCount?: number;
}

export const GanttChart: React.FC<GanttChartProps> = ({ timeline, processes, currentTimeStep, coreCount = 1 }) => {
  const [hoveredSlice, setHoveredSlice] = useState<TimelineSlice | null>(null);
  const [pinnedSlice, setPinnedSlice] = useState<TimelineSlice | null>(null);

  const activeTooltip = pinnedSlice ?? hoveredSlice;

  if (timeline.length === 0) {
    return (
      <div className="card card-body">
        <p className="empty-title">No timeline yet</p>
        <p className="empty-state">Add at least one process to generate a schedule.</p>
      </div>
    );
  }

  const totalTime = timeline[timeline.length - 1].end;
  const colorMap = buildColorMap(processes);

  // Group slices by core
  const numCores = Math.max(1, coreCount);
  const coreSlices = new Map<number, TimelineSlice[]>();
  for (let c = 0; c < numCores; c++) coreSlices.set(c, []);
  timeline.forEach((slice) => {
    const core = slice.core ?? 0;
    if (coreSlices.has(core)) {
      coreSlices.get(core)!.push(slice);
    } else {
      coreSlices.get(0)!.push(slice);
    }
  });

  // Build idle gaps per core (skip over CS/IO occupancy)
  const coreIdleGaps = new Map<number, TimelineSlice[]>();
  for (let c = 0; c < numCores; c++) {
    const slices = coreSlices
      .get(c)!
      .filter((s) => s.pid !== 'idle' || s.kind === 'CONTEXT_SWITCH')
      .sort((a, b) => a.start - b.start);
    const gaps: TimelineSlice[] = [];
    let prevEnd = 0;
    slices.forEach((s) => {
      if (s.start > prevEnd) gaps.push({ pid: 'idle', start: prevEnd, end: s.start, core: c, kind: 'IDLE' });
      prevEnd = Math.max(prevEnd, s.end);
    });
    if (prevEnd < totalTime) gaps.push({ pid: 'idle', start: prevEnd, end: totalTime, core: c, kind: 'IDLE' });
    coreIdleGaps.set(c, gaps);
  }

  const step = niceStep(totalTime);
  const ticks: number[] = [];
  for (let t = 0; t < totalTime; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== totalTime) ticks.push(totalTime);

  const showPlayline = currentTimeStep >= 0 && currentTimeStep <= totalTime;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">CPU Gantt Timeline</div>
          <div className="muted mono" style={{ fontSize: '12px', marginTop: 2 }}>
            Span {totalTime} ms · {timeline.length} slice{timeline.length !== 1 ? 's' : ''}{numCores > 1 ? ` · ${numCores} cores` : ''}
          </div>
        </div>
        <div className="gantt-legend">
          {processes.map((p) => (
            <span key={p.pid} className="gantt-legend-chip">
              <span className="gantt-legend-dot" style={{ background: p.color ?? '#2154f0' }} />
              {p.pid}
            </span>
          ))}
          {timeline.some((s) => s.kind === 'CONTEXT_SWITCH') && (
            <span className="gantt-legend-chip">
              <span className="gantt-legend-dot" style={{ background: 'rgba(139, 147, 161, 0.55)' }} />
              Context switch
            </span>
          )}
          {timeline.some((s) => s.kind === 'IO') && (
            <span className="gantt-legend-chip">
              <span className="gantt-legend-dot" style={{ background: 'rgba(245, 158, 11, 0.7)' }} />
              I/O blocked
            </span>
          )}
        </div>
      </div>

      <div className="card-body">
        <div className="gantt-scroll">
          <div className="gantt-inner">
            {/* Time axis */}
            <div className="gantt-axis">
              {ticks.map((t) => (
                <span key={t} className="axis-tick" style={{ left: `${(t / totalTime) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>

            {/* Render one track per core */}
            {Array.from({ length: numCores }, (_, coreIdx) => {
              const coreBlockSlices = [...(coreIdleGaps.get(coreIdx) ?? []), ...(coreSlices.get(coreIdx) ?? [])]
                .sort((a, b) => a.start - b.start || (a.kind === 'IDLE' ? 1 : 0) - (b.kind === 'IDLE' ? 1 : 0));
              return (
                <div key={coreIdx} style={{ marginBottom: numCores > 1 ? 6 : 0 }}>
                  {numCores > 1 && (
                    <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>
                      Core {coreIdx}
                    </div>
                  )}
                  <div
                    className="gantt-track"
                    onMouseLeave={() => { setHoveredSlice(null); setPinnedSlice(null); }}
                  >
                    {ticks.map((t) => (
                      <span key={t} className="gantt-gridline" style={{ left: `${(t / totalTime) * 100}%` }} />
                    ))}

                    {coreBlockSlices.map((slice, index) => {
                      const duration = slice.end - slice.start;
                      const left = (slice.start / totalTime) * 100;
                      const width = (duration / totalTime) * 100;
                      const isIdle = slice.pid === 'idle';
                      const isCs = slice.kind === 'CONTEXT_SWITCH';
                      const isIo = slice.kind === 'IO';
                      const color = isIdle
                        ? 'transparent'
                        : isCs
                          ? 'rgba(139, 147, 161, 0.45)'
                          : isIo
                            ? 'rgba(245, 158, 11, 0.55)'
                            : (colorMap[slice.pid] ?? '#2154f0');
                      const isActive = currentTimeStep >= slice.start && currentTimeStep < slice.end;
                      const label = isCs ? 'CS' : isIo ? 'IO' : slice.pid;
                      const ariaLabel = isIdle
                        ? `CPU idle ${slice.start} to ${slice.end} milliseconds`
                        : isCs
                          ? `Context switch ${slice.start} to ${slice.end} milliseconds`
                          : isIo
                            ? `I/O wait ${slice.pid} ${slice.start} to ${slice.end} milliseconds`
                            : `${slice.pid} ${slice.start} to ${slice.end} milliseconds, duration ${duration} milliseconds`;

                      return (
                        <div
                          key={`${coreIdx}-${index}`}
                          className={`gantt-block ${isIdle ? 'idle' : ''} ${isCs ? 'cs' : ''} ${isIo ? 'io' : ''} ${isActive ? 'active' : ''}`}
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: isIdle ? undefined : color }}
                          tabIndex={isIdle ? undefined : 0}
                          role={isIdle ? undefined : 'button'}
                          aria-label={isIdle ? undefined : ariaLabel}
                          onMouseEnter={() => setHoveredSlice(slice)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          onFocus={() => setHoveredSlice(slice)}
                          onBlur={() => setHoveredSlice(null)}
                          onClick={() => setPinnedSlice((prev) => (prev === slice ? null : slice))}
                        >
                          {!isIdle && width > 3.2 && (
                            <>
                              {label}
                              {width > 7 && <small>{slice.end - slice.start}ms</small>}
                            </>
                          )}
                          {isIdle && width > 4 && <span>idle</span>}
                        </div>
                      );
                    })}

                    {activeTooltip && (
                      <span
                        className="gantt-tip"
                        style={{ left: `${(activeTooltip.start / totalTime) * 100}%` }}
                      >
                        {activeTooltip.pid === 'idle' && activeTooltip.kind === 'CONTEXT_SWITCH'
                          ? `Context switch · ${activeTooltip.start}–${activeTooltip.end} ms`
                          : activeTooltip.kind === 'IO'
                            ? `${activeTooltip.pid} I/O · ${activeTooltip.start}–${activeTooltip.end} ms`
                            : activeTooltip.pid === 'idle'
                              ? `CPU idle · ${activeTooltip.start}–${activeTooltip.end} ms`
                              : `${activeTooltip.pid} · ${activeTooltip.start}–${activeTooltip.end} ms${numCores > 1 ? ` (core ${activeTooltip.core ?? 0})` : ''}`}
                      </span>
                    )}

                    {showPlayline && (
                      <div className="playline" style={{ left: `${(currentTimeStep / totalTime) * 100}%` }}>
                        <span className="playline-label">{currentTimeStep}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};