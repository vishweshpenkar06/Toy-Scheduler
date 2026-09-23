import { useMemo, useState } from 'react';
import { Process, AlgorithmType } from '../types';
import { sweepQuantum } from '../utils/experiment';
import { ALGORITHMS } from './Header';
import { downloadFile } from '../utils/chartUtils';

interface ExperimentLabProps {
  processes: Process[];
  algorithm: AlgorithmType;
  contextSwitchCost: number;
  coreCount: number;
}

export const ExperimentLab = ({ processes, algorithm, contextSwitchCost, coreCount }: ExperimentLabProps) => {
  const [metric, setMetric] = useState<'avgWait' | 'avgTurnaround' | 'throughput' | 'fairness'>('avgWait');
  const [alg, setAlg] = useState<AlgorithmType>(algorithm);

  const sweep = useMemo(
    () => (processes.length === 0 ? null : sweepQuantum(alg, processes, { contextSwitchCost, coreCount })),
    [alg, processes, contextSwitchCost, coreCount]
  );

  if (processes.length === 0 || !sweep) {
    return (
      <div className="card card-body">
        <p className="empty-title">Nothing to experiment on</p>
        <p className="empty-state">Add processes to run a quantum sensitivity sweep.</p>
      </div>
    );
  }

  const values = sweep.points.map((p) => (metric === 'avgWait' ? p.avgWait : metric === 'avgTurnaround' ? p.avgTurnaround : metric === 'throughput' ? p.throughput : p.fairness));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const best = sweep.points.reduce((bestP, p) => {
    const v = metric === 'avgWait' ? p.avgWait : metric === 'avgTurnaround' ? p.avgTurnaround : metric === 'throughput' ? p.throughput : p.fairness;
    const bv = metric === 'avgWait' ? bestP.avgWait : metric === 'avgTurnaround' ? bestP.avgTurnaround : metric === 'throughput' ? bestP.throughput : bestP.fairness;
    if (metric === 'avgWait' || metric === 'avgTurnaround') return v < bv ? p : bestP;
    return v > bv ? p : bestP;
  }, sweep.points[0]);

  const exportCsv = () => {
    const header = 'quantum,avgWait,avgTurnaround,throughput,fairness\n';
    const rows = sweep.points.map((p) => `${p.param},${p.avgWait},${p.avgTurnaround},${p.throughput},${p.fairness}`).join('\n');
    downloadFile(header + rows, `sweep-${alg}.csv`, 'text/csv');
  };

  return (
    <div className="main-flow">
      <div className="bench-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Experiment lab — quantum sensitivity</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Sweep RR quantum and observe how {metric} responds. Best so far: q={best.param}.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="select" value={alg} onChange={(e) => setAlg(e.target.value as AlgorithmType)} aria-label="Algorithm">
            {ALGORITHMS.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select className="select" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} aria-label="Metric">
            <option value="avgWait">Avg wait</option>
            <option value="avgTurnaround">Turnaround</option>
            <option value="throughput">Throughput</option>
            <option value="fairness">Fairness</option>
          </select>
          <button className="btn btn-quiet" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, padding: '8px 4px 0' }}>
            {sweep.points.map((p) => {
              const v = metric === 'avgWait' ? p.avgWait : metric === 'avgTurnaround' ? p.avgTurnaround : metric === 'throughput' ? p.throughput : p.fairness;
              const norm = (v - min) / range;
              const isBest = p === best;
              const h = metric === 'avgWait' || metric === 'avgTurnaround' ? 100 - norm * 100 : norm * 100;
              return (
                <div key={p.param} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isBest ? 'var(--green)' : 'var(--text-3)' }}>
                    {v.toFixed(2)}
                  </span>
                  <div
                    title={`q=${p.param}: ${v}`}
                    style={{
                      width: '100%',
                      maxWidth: 48,
                      height: `${Math.max(8, h)}%`,
                      background: isBest ? 'var(--green)' : 'var(--accent)',
                      opacity: isBest ? 1 : 0.7,
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>q={p.param}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Sweep table</div>
        </div>
        <div className="card-body table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Quantum</th>
                <th>Avg wait</th>
                <th>Turnaround</th>
                <th>Throughput</th>
                <th>Fairness</th>
              </tr>
            </thead>
            <tbody>
              {sweep.points.map((p) => (
                <tr key={p.param} style={p === best ? { background: 'rgba(16,185,129,0.08)' } : undefined}>
                  <td className="num">{p.param}</td>
                  <td className="num">{p.avgWait.toFixed(2)}</td>
                  <td className="num">{p.avgTurnaround.toFixed(2)}</td>
                  <td className="num">{p.throughput.toFixed(3)}</td>
                  <td className="num">{p.fairness.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
