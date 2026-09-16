import React, { useState, useRef, useEffect } from 'react';
import { soundFx } from '../utils/audio';

interface OnboardingModalProps {
  onClose: () => void;
}

const steps = [
  { title: 'Pick an algorithm', description: 'Choose from 9 CPU scheduling algorithms in the top bar. Each one makes different decisions about which process runs next.', highlight: 'FCFS, SJF, Round Robin, and more' },
  { title: 'Build your workload', description: 'Add processes with arrival times, burst times, and priorities. Use presets or generate random workloads to explore.', highlight: 'Left sidebar' },
  { title: 'Simulate and compare', description: 'Press Play to watch the Gantt chart animate. Switch to Compare mode to rank algorithms side-by-side, or try Race mode to see all 9 run simultaneously.', highlight: 'Playback controls' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const current = steps[step];

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => { prevFocusRef.current?.focus(); };
  }, []);

  const handleNext = () => {
    soundFx.playClick();
    if (step < steps.length - 1) setStep(step + 1);
    else onClose();
  };

  return (
    <dialog ref={ref} className="modal-dialog" style={{ maxWidth: 420 }} onClose={onClose} aria-label="Getting started">
      <div className="modal-body" style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(150deg, #1a44cd, #6d28d9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>
          QS
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)', marginBottom: 8 }}>
          Step {step + 1} of {steps.length}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 8 }}>
          {current.title}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
          {current.description}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 'var(--radius-full)', padding: '4px 12px', display: 'inline-block' }}>
          {current.highlight}
        </div>
      </div>
      <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-quiet" onClick={() => { soundFx.playClick(); onClose(); }}>Skip</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {steps.map((_, idx) => (
            <span key={idx} style={{ width: idx === step ? 20 : 6, height: 6, borderRadius: 3, background: idx === step ? 'var(--accent)' : 'var(--border-strong)', transition: 'all 0.2s var(--ease)' }} />
          ))}
        </div>
        <button className="btn btn-primary" onClick={handleNext}>
          {step < steps.length - 1 ? 'Next' : 'Get started'}
        </button>
      </div>
    </dialog>
  );
};
