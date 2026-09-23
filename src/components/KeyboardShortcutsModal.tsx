import React, { useRef, useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: 'Space', desc: 'Play / pause simulation' },
  { keys: '← / →', desc: 'Step back / forward by 1 ms' },
  { keys: 'R', desc: 'Reset playback to t = 0' },
  { keys: '1–9', desc: 'Select algorithm 1–9 (FCFS … MLFQ)' },
  { keys: 'Shift+1–8', desc: 'Select algorithm 10–17 (HRRN … Adaptive RR)' },
  { keys: 'C', desc: 'Cycle view (Visualizer / Benchmark / Race / Experiment / Learning / Interview)' },
  { keys: 'L', desc: 'Learning mode' },
  { keys: 'I', desc: 'Interview mode' },
  { keys: 'Ctrl/Cmd + K', desc: 'Open command palette' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <dialog ref={ref} className="modal-dialog" onClose={onClose} aria-label="Keyboard shortcuts">
      <div className="modal-head">
        <div>
          <div className="modal-title">Keyboard shortcuts</div>
          <div className="modal-sub">Speed up your workflow while steering the simulation.</div>
        </div>
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
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
    </dialog>
  );
};
