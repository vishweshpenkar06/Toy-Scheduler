import React from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: 'Space', desc: 'Play / pause simulation' },
    { keys: '← / →', desc: 'Step back / forward by 1 ms' },
    { keys: 'R', desc: 'Reset playback to t = 0' },
    { keys: '1 – 9', desc: 'Switch algorithm (FCFS, SJF, SRTF, RR, Priority NP/P, Priority+Aging, MLQ, MLFQ)' },
    { keys: 'C', desc: 'Toggle between visualizer and benchmark' },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="modal-head">
          <div>
            <div className="modal-title">Keyboard shortcuts</div>
            <div className="modal-sub">Speed up your workflow while steering the simulation.</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="hint-list">
            {shortcuts.map((s) => (
              <div key={s.keys} className="hint-row">
                <span className="hint-desc">{s.desc}</span>
                <span className="kbd">{s.keys}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
};