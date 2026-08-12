import React from 'react';
import { ProcessResult, Process } from '../types';

interface ProcessResultsTableProps {
  results: ProcessResult[];
  processes: Process[];
}

export const ProcessResultsTable: React.FC<ProcessResultsTableProps> = ({ results, processes }) => {
  const colorMap = new Map<string, string>();
  const arrivalMap = new Map<string, number>();
  const burstMap = new Map<string, number>();
  processes.forEach((p) => {
    colorMap.set(p.pid, p.color ?? '#2154f0');
    arrivalMap.set(p.pid, p.arrivalTime);
    burstMap.set(p.pid, p.burstTime);
  });

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Per-process results</div>
        <span className="card-count">{results.length} processes</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Process</th>
              <th>Arrival</th>
              <th>Burst</th>
              <th>Completion</th>
              <th>Turnaround</th>
              <th>Waiting</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const color = colorMap.get(r.pid) ?? '#2154f0';
              return (
                <tr key={r.pid}>
                  <td>
                    <span className="pill">
                      <span className="pill-dot" style={{ background: color }} />
                      {r.pid}
                    </span>
                  </td>
                  <td className="num cell-muted">{arrivalMap.get(r.pid) ?? 0} ms</td>
                  <td className="num cell-muted">{burstMap.get(r.pid) ?? 0} ms</td>
                  <td className="num">{r.completionTime} ms</td>
                  <td className="num">{r.turnaroundTime} ms</td>
                  <td className="num cell-accent">{r.waitingTime} ms</td>
                  <td className="num">{r.responseTime} ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};