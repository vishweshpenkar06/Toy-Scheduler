import React, { useState } from 'react';
import { TimelineSlice, Process } from '../types';

interface GanttChartProps {
  timeline: TimelineSlice[];
  processes: Process[];
  currentTimeStep: number;
}

function niceStep(max: number): number {
  const raw = max / 10;
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export const GanttChart: React.FC<GanttChartProps> = ({ timeline, processes, currentTimeStep }) => {
  const [hoveredSlice, setHoveredSlice] = useState<TimelineSlice | null>(null);

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

  // Idle gaps between scheduled slices
  const idleGaps: TimelineSlice[] = [];
  let prevEnd = 0;
  timeline.forEach((slice) => {
    if (slice.start > prevEnd) idleGaps.push({ pid: 'idle', start: prevEnd, end: slice.start });
    prevEnd = Math.max(prevEnd, slice.end);
  });

  const step = niceStep(totalTime);
  const ticks: number[] = [];
  for (let t = 0; t < totalTime; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== totalTime) ticks.push(totalTime);

  const allBlocks: TimelineSlice[] = [...idleGaps, ...timeline];
  const activeSliceIndex = allBlocks.findIndex((s) => currentTimeStep >= s.start && currentTimeStep < s.end);
  const showPlayline = currentTimeStep >= 0 && currentTimeStep <= totalTime;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">CPU Gantt Timeline</div>
          <div className="muted mono" style={{ fontSize: '12px', marginTop: 2 }}>
            Span {totalTime} ms · {timeline.length} slices{idleGaps.length > 0 ? ` · ${idleGaps.length} idle gap${idleGaps.length > 1 ? 's' : ''}` : ''}
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

            {/* Track */}
            <div
              className="gantt-track"
              onMouseLeave={() => setHoveredSlice(null)}
            >
              {/* Gridlines */}
              {ticks.map((t) => (
                <span key={t} className="gantt-gridline" style={{ left: `${(t / totalTime) * 100}%` }} />
              ))}

              {/* Blocks + idle gaps */}
              {allBlocks.map((slice, index) => {
                const duration = slice.end - slice.start;
                const left = (slice.start / totalTime) * 100;
                const width = (duration / totalTime) * 100;
                const isIdle = slice.pid === 'idle';
                const color = isIdle ? 'transparent' : colorMap.get(slice.pid) ?? '#2154f0';
                const isActive = index === activeSliceIndex;

                return (
                  <div
                    key={index}
                    className={`gantt-block ${isIdle ? 'idle' : ''} ${isActive ? 'active' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: isIdle ? undefined : color }}
                    onMouseEnter={() => setHoveredSlice(slice)}
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

              {/* Hover tooltip */}
              {hoveredSlice && (
                <span
                  className="gantt-tip"
                  style={{ left: `${(hoveredSlice.start / totalTime) * 100}%` }}
                >
                  {hoveredSlice.pid === 'idle'
                    ? `CPU idle · ${hoveredSlice.start}–${hoveredSlice.end} ms`
                    : `${hoveredSlice.pid} · ${hoveredSlice.start}–${hoveredSlice.end} ms`}
                </span>
              )}

              {/* Playhead */}
              {showPlayline && (
                <div className="playline" style={{ left: `${(currentTimeStep / totalTime) * 100}%` }}>
                  <span className="playline-label">{currentTimeStep}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};