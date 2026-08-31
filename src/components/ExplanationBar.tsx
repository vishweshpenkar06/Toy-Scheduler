import React, { useMemo } from 'react';
import { Process, TimelineSlice, AlgorithmType, DecisionEntry } from '../types';
import { generateDecisionLog } from '../utils/decisionLog';

interface ExplanationBarProps {
  timeline: TimelineSlice[];
  processes: Process[];
  algorithm: AlgorithmType;
  currentTimeStep: number;
}

export const ExplanationBar: React.FC<ExplanationBarProps> = ({ timeline, processes, algorithm, currentTimeStep }) => {
  const decisionLog = useMemo(
    () => generateDecisionLog(timeline, processes, algorithm),
    [timeline, processes, algorithm]
  );

  if (decisionLog.length === 0) return null;

  // Find the decision for the current time step
  const currentDecision = decisionLog.find(
    (d) => currentTimeStep >= d.time && currentTimeStep < d.time + 1
  ) ?? decisionLog[decisionLog.length - 1];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--accent)',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Why?
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-2)',
          lineHeight: 1.4,
        }}
      >
        {currentDecision.message}
      </span>
    </div>
  );
};
