import React, { useState } from 'react';
import { Process } from '../types';
import { soundFx } from '../utils/audio';

const COLOR_PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface ProcessControlCenterProps {
  processes: Process[];
  onAddProcess: (process: Process) => void;
  onRemoveProcess: (pid: string) => void;
  onClearAll: () => void;
  onResetDefault: () => void;
  onGenerateRandom: () => void;
}

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

const DiceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="0.6" fill="currentColor" />
    <circle cx="15.5" cy="8.5" r="0.6" fill="currentColor" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    <circle cx="8.5" cy="15.5" r="0.6" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="0.6" fill="currentColor" />
  </svg>
);

const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4h4" />
  </svg>
);

export const ProcessControlCenter: React.FC<ProcessControlCenterProps> = ({
  processes,
  onAddProcess,
  onRemoveProcess,
  onClearAll,
  onResetDefault,
  onGenerateRandom,
}) => {
  const [pid, setPid] = useState(`P${processes.length + 1}`);
  const [arrivalTime, setArrivalTime] = useState(0);
  const [burstTime, setBurstTime] = useState(4);
  const [priority, setPriority] = useState(1);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[processes.length % COLOR_PALETTE.length]);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedPid = pid.trim().toUpperCase();
    if (!trimmedPid) {
      setErrorMsg('Process ID is required.');
      return;
    }
    if (processes.some((p) => p.pid === trimmedPid)) {
      setErrorMsg(`A process named "${trimmedPid}" already exists.`);
      return;
    }
    if (arrivalTime < 0) {
      setErrorMsg('Arrival time cannot be negative.');
      return;
    }
    if (burstTime <= 0) {
      setErrorMsg('Burst time must be greater than zero.');
      return;
    }

    soundFx.playClick();
    onAddProcess({ pid: trimmedPid, arrivalTime, burstTime, priority, color: selectedColor });

    setPid(`P${processes.length + 2}`);
    setSelectedColor(COLOR_PALETTE[(processes.length + 1) % COLOR_PALETTE.length]);
    setArrivalTime(0);
    setBurstTime(4);
    setPriority(1);
  };

  return (
    <>
      {/* Workload list */}
      <div className="card">
        <div className="list-head">
          <div className="list-title">
            Workload
            <span className="card-count">{processes.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="btn btn-quiet" title="Generate random workload" onClick={() => { soundFx.playClick(); onGenerateRandom(); }}>
              <DiceIcon /> Random
            </button>
            <button className="btn btn-quiet" title="Reset to default preset" onClick={() => { soundFx.playClick(); onResetDefault(); }}>
              <ResetIcon /> Reset
            </button>
            <button className="btn btn-quiet" title="Clear all processes" style={{ color: 'var(--red)' }} onClick={() => { soundFx.playClick(); onClearAll(); }}>
              Clear
            </button>
          </div>
        </div>
        <div className="hairline" />
        {processes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">An empty workload</div>
            <div className="muted" style={{ fontSize: '12.5px' }}>Add a process below, load a preset, or generate random tasks.</div>
          </div>
        ) : (
          <div className="process-list">
            {processes.map((p) => (
              <div key={p.pid} className="proc-row">
                <span className="proc-dot" style={{ background: p.color ?? '#2154f0' }} />
                <div className="proc-row-info">
                  <div className="proc-name">{p.pid}</div>
                  <div className="proc-meta">
                    arr {p.arrivalTime} · burst {p.burstTime} · pri {p.priority ?? '–'}
                  </div>
                </div>
                <button
                  className="icon-btn proc-del"
                  title={`Remove ${p.pid}`}
                  onClick={() => { soundFx.playClick(); onRemoveProcess(p.pid); }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New process form */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <PlusIcon />
            <span>New process</span>
          </div>
        </div>
        <form className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="pid-field">Process ID</label>
            <input id="pid-field" className="input" value={pid} onChange={(e) => setPid(e.target.value)} placeholder="e.g. P5" />
          </div>

          <div className="field-grid-3">
            <div className="field">
              <label className="field-label" htmlFor="arr-field">Arrival</label>
              <input id="arr-field" className="input" type="number" min={0} value={arrivalTime} onChange={(e) => setArrivalTime(parseInt(e.target.value, 10) || 0)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="burst-field">Burst</label>
              <input id="burst-field" className="input" type="number" min={1} value={burstTime} onChange={(e) => setBurstTime(parseInt(e.target.value, 10) || 1)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pri-field">Priority</label>
              <input id="pri-field" className="input" type="number" min={0} value={priority} onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Color</span>
            <div className="color-row">
              {COLOR_PALETTE.map((c) => (
                <span
                  key={c}
                  className={`swatch ${selectedColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setSelectedColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="form-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12" y2="16" />
              </svg>
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block">
            <PlusIcon /> Add process
          </button>
        </form>
      </div>
    </>
  );
};