import { useMemo, useState } from 'react';
import { AlgorithmType, Process, SimulationResult } from '../types';
import { buildLessons, scenarioInsights } from './learningContent';
import { soundFx } from '../utils/audio';

interface LearningModeProps {
  algorithm: AlgorithmType;
  processes: Process[];
  result: SimulationResult;
}

export const LearningMode = ({ algorithm, processes, result }: LearningModeProps) => {
  const lessons = useMemo(() => buildLessons(algorithm), [algorithm]);
  const insights = useMemo(() => scenarioInsights(result, processes, algorithm), [result, processes, algorithm]);
  const [open, setOpen] = useState<string | null>(lessons[0]?.id ?? null);

  return (
    <div className="main-flow">
      <div className="bench-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Learning mode</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Concept cards for the selected algorithm plus live scenario insights.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Scenario snapshot</div>
        </div>
        <div className="card-body">
          <div className="state-board">
            {insights.map((i) => (
              <div key={i.label} className="state-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-1)', borderColor: 'var(--border-strong)' }}>
                <span className="state-label" style={{ color: 'var(--text-3)' }}>{i.label}</span>
                <span className="state-pid">{i.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Concept cards</div>
          <span className="card-count">{lessons.length}</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lessons.map((lesson) => {
            const isOpen = open === lesson.id;
            return (
              <div key={lesson.id} className="preset-item" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <button
                  type="button"
                  className="preset-top"
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                  aria-expanded={isOpen}
                  onClick={() => { soundFx.playClick(); setOpen(isOpen ? null : lesson.id); }}
                >
                  <span className="preset-name">{lesson.title}</span>
                  <span className="preset-count">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="preset-desc" style={{ marginTop: 6 }}>
                    {lesson.body}
                    {lesson.tip && (
                      <div style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 600 }}>{lesson.tip}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
