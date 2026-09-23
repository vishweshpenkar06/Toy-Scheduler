import { useMemo } from 'react';
import { Process, SimulationResult, AlgorithmType } from '../types';
import { runAlgorithm } from '../engine/runAlgorithm';
import { ALGORITHMS } from './Header';
import { niceStep, buildColorMap } from '../utils/chartUtils';

interface RaceModeProps {
  processes: Process[];
  quantum: number;
  currentTimeStep: number;
  onSelectAlgorithm: (alg: AlgorithmType) => void;
}

interface RaceEntry {
  id: AlgorithmType;
  name: string;
  result: SimulationResult;
  totalTime: number;
  isFinished: boolean;
}

const MINI_TRACK_HEIGHT = 36;

export const RaceMode: React.FC<RaceModeProps> = ({ processes, quantum, currentTimeStep, onSelectAlgorithm }) => {
  const entries: RaceEntry[] = useMemo(() => {
    if (processes.length === 0) return [];
    return ALGORITHMS.map((alg) => {
      const result = runAlgorithm(alg.id, processes, { quantum });
      const totalTime = result.timeline.length > 0 ? result.timeline[result.timeline.length - 1].end : 0;
      return {
        id: alg.id,
        name: alg.name,
        result,
        totalTime,
        isFinished: currentTimeStep >= totalTime,
      };
    });
  }, [processes, quantum, currentTimeStep]);

  if (processes.length === 0) {
    return (
      <div className="card card-body">
        <p className="empty-title">Nothing to race</p>
        <p className="empty-state">Configure a workload to race all algorithms head-to-head.</p>
      </div>
    );
  }

  const globalMaxTime = Math.max(...entries.map((e) => e.totalTime), 1);
  const bestTime = Math.min(...entries.map((e) => e.totalTime).filter((t) => t > 0));
  const bestEntry = entries.find((e) => Math.abs(e.totalTime - bestTime) < 0.001);

  const colorMap = buildColorMap(processes);

  const step = niceStep(globalMaxTime);
  const ticks: number[] = [];
  for (let t = 0; t <= globalMaxTime; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== globalMaxTime) ticks.push(globalMaxTime);

  return (
    <div className="main-flow">
      <div className="bench-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>Algorithm Race</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Watch all algorithms process {processes.length} processes in real-time
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries
          .sort((a, b) => a.totalTime - b.totalTime)
          .map((entry, rank) => {
            const isBest = entry.id === bestEntry?.id;
            const busyTime = entry.result.timeline
              .filter((s) => s.pid !== 'idle')
              .reduce((sum, s) => sum + (s.end - s.start), 0);
            const contextSwitches = entry.result.timeline.filter((s) => s.pid !== 'idle').length;

            return (
              <div
                key={entry.id}
                onClick={() => { onSelectAlgorithm(entry.id); }}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isBest ? 'rgba(15, 145, 104, 0.55)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'border-color 0.14s var(--ease)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 700,
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isBest ? 'var(--green)' : 'var(--surface-2)',
                      color: isBest ? '#fff' : 'var(--text-3)',
                    }}
                  >
                    {rank + 1}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{entry.name}</span>
                  {isBest && (
                    <span
                      className="rank-tag best"
                      style={{ fontSize: 10, padding: '1px 7px' }}
                    >
                      Fastest
                    </span>
                  )}
                  {entry.isFinished && currentTimeStep > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--green)',
                        fontWeight: 600,
                      }}
                    >
                      Done at t={entry.totalTime}
                    </span>
                  )}
                </div>

                {/* Mini Gantt */}
                <div
                  style={{
                    position: 'relative',
                    height: MINI_TRACK_HEIGHT,
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  {ticks.map((t) => (
                    <span
                      key={t}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: 'var(--border)',
                        left: `${(t / globalMaxTime) * 100}%`,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {entry.result.timeline.map((slice, i) => {
                    const isIdle = slice.pid === 'idle';
                    const color = isIdle ? 'transparent' : (colorMap[slice.pid] ?? '#2154f0');
                    return (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          top: 3,
                          bottom: 3,
                          left: `${(slice.start / globalMaxTime) * 100}%`,
                          width: `${((slice.end - slice.start) / globalMaxTime) * 100}%`,
                          borderRadius: 3,
                          background: isIdle
                            ? 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(139,147,161,0.2) 3px, rgba(139,147,161,0.2) 4px)'
                            : color,
                          transition: 'filter 0.1s',
                        }}
                      />
                    );
                  })}

                  {/* Playhead */}
                  {currentTimeStep >= 0 && currentTimeStep <= globalMaxTime && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${(currentTimeStep / globalMaxTime) * 100}%`,
                        width: 2,
                        background: 'var(--accent)',
                        zIndex: 3,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                  <span>
                    Total: <strong style={{ color: isBest ? 'var(--green)' : 'var(--text-1)' }}>{entry.totalTime}ms</strong>
                  </span>
                  <span>Avg wait: <strong>{entry.result.averageWaitingTime.toFixed(1)}ms</strong></span>
                  <span>CPU util: <strong style={{ color: 'var(--green)' }}>
                    {entry.totalTime > 0 ? ((busyTime / entry.totalTime) * 100).toFixed(0) : 0}%
                  </strong></span>
                  <span>Slices: <strong>{contextSwitches}</strong></span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
