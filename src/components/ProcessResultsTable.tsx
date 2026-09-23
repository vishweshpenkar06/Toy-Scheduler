import { ProcessResult, Process } from '../types';
import { buildColorMap } from '../utils/chartUtils';

interface ProcessResultsTableProps {
  results: ProcessResult[];
  processes: Process[];
}

export const ProcessResultsTable = ({ results, processes }: ProcessResultsTableProps) => {
  const colorMap = buildColorMap(processes);
  const processMap = new Map(processes.map((p) => [p.pid, p]));

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
              <th title="Context switches">CS</th>
              <th title="Deadline missed">Miss</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const p = processMap.get(r.pid);
              return (
                <tr key={r.pid}>
                  <td>
                    <span className="pill">
                      <span className="pill-dot" style={{ background: colorMap[r.pid] }} />
                      {r.pid}
                    </span>
                  </td>
                  <td className="num cell-muted">{p?.arrivalTime ?? 0} ms</td>
                  <td className="num cell-muted">{p?.burstTime ?? 0} ms</td>
                  <td className="num">{r.completionTime} ms</td>
                  <td className="num">{r.turnaroundTime} ms</td>
                  <td className="num cell-accent">{r.waitingTime} ms</td>
                  <td className="num">{r.responseTime} ms</td>
                  <td className="num cell-muted">{r.contextSwitches ?? 0}</td>
                  <td className="num" style={{ color: r.deadlineMiss ? 'var(--red, #ef4444)' : 'var(--text-3)' }}>
                    {p?.deadline != null ? (r.deadlineMiss ? 'miss' : 'ok') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
