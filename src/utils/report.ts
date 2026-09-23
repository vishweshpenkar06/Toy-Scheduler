import { Process, AlgorithmType, SimulationResult } from '../types';
import { ALGORITHMS } from '../components/Header';
import { downloadFile } from './chartUtils';

export interface ReportInput {
  processes: Process[];
  algorithm: AlgorithmType;
  quantum: number;
  coreCount: number;
  contextSwitchCost: number;
  result: SimulationResult;
}

export function buildReportMarkdown(input: ReportInput): string {
  const name = ALGORITHMS.find((a) => a.id === input.algorithm)?.name ?? input.algorithm;
  const m = input.result.metrics;
  const lines: string[] = [
    `# Quantum Scheduler Report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Configuration`,
    ``,
    `- Algorithm: **${name}** (\`${input.algorithm}\`)`,
    `- Quantum: ${input.quantum}`,
    `- Cores: ${input.coreCount}`,
    `- Context-switch cost: ${input.contextSwitchCost} ms`,
    `- Processes: ${input.processes.length}`,
    ``,
    `## Summary metrics`,
    ``,
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Avg waiting | ${input.result.averageWaitingTime.toFixed(3)} ms |`,
    `| Avg turnaround | ${input.result.averageTurnaroundTime.toFixed(3)} ms |`,
    `| Avg response | ${input.result.averageResponseTime.toFixed(3)} ms |`,
  ];
  if (m) {
    lines.push(`| Throughput | ${m.throughput.toFixed(4)} /ms |`);
    lines.push(`| CPU utilization | ${m.cpuUtilization.toFixed(2)}% |`);
    lines.push(`| Context switches | ${m.contextSwitchCount} |`);
    lines.push(`| Jain fairness | ${m.jainFairness.toFixed(4)} |`);
    lines.push(`| Wait p50 / p95 | ${m.waitingP50.toFixed(2)} / ${m.waitingP95.toFixed(2)} ms |`);
    lines.push(`| Deadline misses | ${m.deadlineMisses} |`);
  }
  lines.push('', '## Per-process results', '');
  lines.push('| PID | Arrival | Completion | Turnaround | Waiting | Response | CS | Miss |');
  lines.push('|-----|--------:|-----------:|-----------:|--------:|---------:|---:|:----:|');
  const byPid = new Map(input.processes.map((p) => [p.pid, p]));
  for (const r of input.result.processResults) {
    const p = byPid.get(r.pid);
    lines.push(
      `| ${r.pid} | ${p?.arrivalTime ?? 0} | ${r.completionTime} | ${r.turnaroundTime} | ${r.waitingTime} | ${r.responseTime} | ${r.contextSwitches ?? 0} | ${p?.deadline != null ? (r.deadlineMiss ? 'miss' : 'ok') : '—'} |`
    );
  }
  lines.push('', '## Workload', '');
  lines.push('| PID | Arrival | Burst | Priority | Tickets | Deadline |');
  lines.push('|-----|--------:|------:|---------:|--------:|---------:|');
  for (const p of input.processes) {
    lines.push(
      `| ${p.pid} | ${p.arrivalTime} | ${p.burstTime} | ${p.priority ?? '—'} | ${p.tickets ?? '—'} | ${p.deadline ?? '—'} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function downloadReport(input: ReportInput): void {
  const md = buildReportMarkdown(input);
  downloadFile(md, `quantum-scheduler-report.md`, 'text/markdown');
}

export function buildResultsCsv(result: SimulationResult): string {
  const header = 'pid,waitingTime,turnaroundTime,responseTime,completionTime,contextSwitches,deadlineMiss\n';
  const rows = result.processResults
    .map((r) =>
      [r.pid, r.waitingTime, r.turnaroundTime, r.responseTime, r.completionTime, r.contextSwitches ?? 0, r.deadlineMiss ?? '']
        .join(',')
    )
    .join('\n');
  return header + rows + '\n';
}
