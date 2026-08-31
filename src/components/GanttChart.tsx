import React, { useState } from 'react';
import { TimelineSlice, Process } from '../types';

interface GanttChartProps {
  timeline: TimelineSlice[];
  processes: Process[];
  currentTimeStep: number;
  coreCount?: number;
}

function niceStep(max: number): number {
  const raw = max / 10;
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
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
  const colorMap = new Map<string, string>();
  processes.forEach((p) => colorMap.set(p.pid, p.color ?? '#2154f0'));

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

  // Build idle gaps per core
  const coreIdleGaps = new Map<number, TimelineSlice[]>();
  for (let c = 0; c < numCores; c++) {
    const slices = coreSlices.get(c)!.filter((s) => s.pid !== 'idle').sort((a, b) => a.start - b.start);
    const gaps: TimelineSlice[] = [];
    let prevEnd = 0;
    slices.forEach((s) => {
      if (s.start > prevEnd) gaps.push({ pid: 'idle', start: prevEnd, end: s.start, core: c });
      prevEnd = Math.max(prevEnd, s.end);
    });
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
              const coreBlockSlices = [...(coreIdleGaps.get(coreIdx) ?? []), ...(coreSlices.get(coreIdx) ?? [])];
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
                      const color = isIdle ? 'transparent' : colorMap.get(slice.pid) ?? '#2154f0';
                      const isActive = currentTimeStep >= slice.start && currentTimeStep < slice.end;
                      const ariaLabel = isIdle
                        ? `CPU idle ${slice.start} to ${slice.end} milliseconds`
                        : `${slice.pid} ${slice.start} to ${slice.end} milliseconds, duration ${duration} milliseconds`;

                      return (
                        <div
                          key={`${coreIdx}-${index}`}
                          className={`gantt-block ${isIdle ? 'idle' : ''} ${isActive ? 'active' : ''}`}
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
                              {slice.pid}
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
                        {activeTooltip.pid === 'idle'
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