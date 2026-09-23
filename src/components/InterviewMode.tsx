import { useMemo, useState } from 'react';
import { buildQuiz } from './learningContent';
import { soundFx } from '../utils/audio';

interface InterviewModeProps {
  seed?: number;
}

export const InterviewMode = ({ seed = 1 }: InterviewModeProps) => {
  const questions = useMemo(() => buildQuiz(seed), [seed]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [done, setDone] = useState(false);

  const q = questions[index];

  const answer = (i: number) => {
    if (answered) return;
    setPicked(i);
    setAnswered(true);
    if (i === q.correctIndex) {
      setScore((s) => s + 1);
      soundFx.playPlay();
    } else {
      soundFx.playPause();
    }
  };

  const next = () => {
    soundFx.playClick();
    if (index + 1 >= questions.length) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setAnswered(false);
  };

  const restart = () => {
    soundFx.playClick();
    setIndex(0);
    setPicked(null);
    setAnswered(false);
    setScore(0);
    setDone(false);
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="main-flow">
        <div className="card card-body" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)' }}>
            Interview complete
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, margin: '12px 0', color: pct >= 70 ? 'var(--green)' : 'var(--amber)' }}>
            {score} / {questions.length}
          </div>
          <div className="muted" style={{ marginBottom: 16 }}>
            {pct >= 80 ? 'Strong fundamentals.' : pct >= 50 ? 'Good — review trade-offs.' : 'Revisit concept cards in Learning mode.'}
          </div>
          <button className="btn btn-primary" onClick={restart}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-flow">
      <div className="bench-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Interview mode</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Question {index + 1} of {questions.length} · Score {score}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {questions.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === index ? 18 : 8,
                height: 8,
                borderRadius: 4,
                background: i === index ? 'var(--accent)' : i < index ? 'var(--green)' : 'var(--border-strong)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 16, lineHeight: 1.5 }}>
            {q.prompt}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.choices.map((choice, i) => {
              let style: React.CSSProperties = {
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: 13.5,
              };
              if (answered) {
                if (i === q.correctIndex) {
                  style = { ...style, borderColor: 'var(--green)', background: 'var(--green-soft)', color: 'var(--green)', fontWeight: 600 };
                } else if (i === picked) {
                  style = { ...style, borderColor: 'var(--red)', background: 'var(--red-soft)', color: 'var(--red)' };
                } else {
                  style = { ...style, opacity: 0.55 };
                }
              }
              return (
                <button key={i} type="button" className="btn" style={style} disabled={answered} onClick={() => answer(i)}>
                  <span style={{ fontFamily: 'var(--font-mono)', marginRight: 10, opacity: 0.7 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {choice}
                </button>
              );
            })}
          </div>
          {answered && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-2)' }}>
              <strong style={{ color: 'var(--text-1)' }}>
                {picked === q.correctIndex ? 'Correct.' : 'Not quite.'}
              </strong>{' '}
              {q.explain}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!answered} onClick={next}>
              {index + 1 >= questions.length ? 'Finish' : 'Next question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
