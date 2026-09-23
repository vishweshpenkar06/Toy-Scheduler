import React, { useMemo } from 'react';
import { Process, SimulationResult, AlgorithmType } from '../types';
import { runAlgorithm } from '../engine/runAlgorithm';
import { ALGORITHMS } from './Header';
import { soundFx } from '../utils/audio';

interface AlgorithmLeaderboardProps {
  processes: Process[];
  quantum: number;
  onSelectAlgorithm: (alg: AlgorithmType) => void;
}

interface RankedRow {
  id: AlgorithmType;
  name: string;
  isPreemptive: boolean;
  result: SimulationResult;
  avgWait: number;
  avgTurnaround: number;
  avgResponse: number;
}

export const AlgorithmLeaderboard: React.FC<AlgorithmLeaderboardProps> = ({ processes, quantum, onSelectAlgorithm }) => {
  const rows: RankedRow[] = useMemo(() => {
    if (processes.length === 0) return [];
    return ALGORITHMS.map((alg) => {
      const result = runAlgorithm(alg.id, processes, { quantum });
      return {
        id: alg.id,
        name: alg.name,
        isPreemptive: alg.isPreemptive,
        result,
        avgWait: result.averageWaitingTime,
        avgTurnaround: result.averageTurnaroundTime,
        avgResponse: result.averageResponseTime,
      };
    }).sort((a, b) => a.avgWait - b.avgWait || a.name.localeCompare(b.name));
  }, [processes, quantum]);

  if (processes.length === 0) {
    return (
      <div className="card card-body">
        <p className="empty-title">Nothing to benchmark</p>
        <p className="empty-state">Configure a workload to compare all six algorithms side by side.</p>
      </div>
    );
  }

  const maxWait = Math.max(...rows.map((r) => r.avgWait), 1);
  const minWait = Math.min(...rows.map((r) => r.avgWait));

  return (
    <div className="main-flow">
      <div className="bench-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>Algorithm benchmark</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Ranked by average waiting time on your current workload of {processes.length} processes
          </div>
        </div>
      </div>

      <div className="rank-list">
        {rows.map((row, i) => {
          const best = Math.abs(row.avgWait - minWait) < 0.001;
          const barWidth = Math.max(4, (row.avgWait / maxWait) * 100);
          return (
            <div key={row.id} className={`rank-card ${best ? 'best' : ''}`} onClick={() => { soundFx.playClick(); onSelectAlgorithm(row.id); }}>
              <div className="rank-no">{best ? '1st' : i + 1}</div>

              <div className="rank-main">
                <div className="rank-name-row">
                  <span className="rank-name">{row.name}</span>
                  <span className={`rank-tag ${best ? 'best' : ''}`}>{row.isPreemptive ? 'Preemptive' : 'Non-preemptive'}</span>
                  {best && <span className="rank-tag best">Optimal wait</span>}
                </div>
                <div className="rank-metrics">
                  <span className="rank-metric">
                    <span className="rank-metric-label">Avg wait</span>
                    <span className="rank-metric-value" style={{ color: best ? 'var(--green)' : 'var(--text-1)' }}>{row.avgWait.toFixed(2)} ms</span>
                  </span>
                  <span className="rank-metric">
                    <span className="rank-metric-label">Turnaround</span>
                    <span className="rank-metric-value">{row.avgTurnaround.toFixed(2)} ms</span>
                  </span>
                  <span className="rank-metric">
                    <span className="rank-metric-label">Response</span>
                    <span className="rank-metric-value">{row.avgResponse.toFixed(2)} ms</span>
                  </span>
                  <div className="rank-bar">
                    <div className="rank-bar-fill" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              </div>

              <button
                className="btn btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  soundFx.playClick();
                  onSelectAlgorithm(row.id);
                }}
              >
                Open timeline
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};