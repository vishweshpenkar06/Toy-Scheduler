import React from 'react';
import { SimulationResult } from '../types';

interface MetricsCardsProps {
  result: SimulationResult;
  coreCount?: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ result, coreCount = 1 }) => {
  const { averageWaitingTime, averageTurnaroundTime, averageResponseTime, timeline } = result;

  const totalSpan = timeline.length > 0 ? Math.max(...timeline.map((s) => s.end)) : 0;
  const idleSpan = timeline.filter((s) => s.pid === 'idle').reduce((sum, s) => sum + (s.end - s.start), 0);
  const busySpan = totalSpan - idleSpan;
  const cpuUtilization = totalSpan > 0 ? (busySpan / (totalSpan * coreCount)) * 100 : 0;

  const stats: { label: string; value: string; unit: string; accent: string; foot: string }[] = [
    { label: 'Avg waiting', value: averageWaitingTime.toFixed(2), unit: 'ms', accent: 'var(--accent)', foot: 'Lower is better' },
    { label: 'Turnaround', value: averageTurnaroundTime.toFixed(2), unit: 'ms', accent: 'var(--text-1)', foot: 'Completion − arrival' },
    { label: 'Response', value: averageResponseTime.toFixed(2), unit: 'ms', accent: 'var(--text-1)', foot: 'First CPU acquisition' },
    { label: 'CPU utilization', value: cpuUtilization.toFixed(1), unit: '%', accent: 'var(--green)', foot: 'Busy / total span' },
  ];

  return (
    <div className="stat-grid">
      {stats.map((s) => (
        <div key={s.label} className="stat" style={{ '--stat-accent': s.accent } as React.CSSProperties}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">
            {s.value}
            <span className="stat-unit">{s.unit}</span>
          </div>
          <div className="stat-foot">{s.foot}</div>
        </div>
      ))}
    </div>
  );
};