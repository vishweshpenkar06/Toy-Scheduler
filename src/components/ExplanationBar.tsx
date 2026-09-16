import { useMemo } from 'react';
import { Process, TimelineSlice, AlgorithmType } from '../types';
import { generateDecisionLog } from '../utils/decisionLog';

interface ExplanationBarProps {
  timeline: TimelineSlice[];
  processes: Process[];
  algorithm: AlgorithmType;
  currentTimeStep: number;
}

export const ExplanationBar = ({ timeline, processes, algorithm, currentTimeStep }: ExplanationBarProps) => {
  const decisionLog = useMemo(
    () => generateDecisionLog(timeline, processes, algorithm),
    [timeline, processes, algorithm]
  );

  if (decisionLog.length === 0) return null;

  const currentDecision = decisionLog.find((d) => d.time === currentTimeStep) ?? decisionLog[decisionLog.length - 1];

  return (
    <div className="explanation-bar">
      <span className="explanation-label">Why?</span>
      <span className="explanation-message">{currentDecision.message}</span>
    </div>
  );
};
