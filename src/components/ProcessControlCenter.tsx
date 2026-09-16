import React, { useState, useRef } from 'react';
import { Process } from '../types';
import { soundFx } from '../utils/audio';
import { validateProcessInput } from '../engine/scheduler';

const COLOR_PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface ProcessControlCenterProps {
  processes: Process[];
  onAddProcess: (process: Process) => void;
  onRemoveProcess: (pid: string) => void;
  onClearAll: () => void;
  onResetDefault: () => void;
  onGenerateRandom: () => void;
  onImportProcesses: (processes: Process[]) => void;
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

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface PendingImport {
  processes: Process[];
  errors: ImportError[];
  duplicatePids: string[];
}

function parseCSV(text: string): Process[] {
  const lines = text.trim().split('\n');
  if (lines.length < 1) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('pid') || header.includes('process');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .filter((line) => line.trim())
    .map((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      const pid = cols[0] || `P${idx + 1}`;
      const arrivalTime = parseInt(cols[1], 10) || 0;
      const burstTime = parseInt(cols[2], 10) || 1;
      const priority = cols[3] ? parseInt(cols[3], 10) : undefined;
      return { pid: pid.toUpperCase(), arrivalTime, burstTime, priority, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] };
    });
}

function parseJSON(text: string): Process[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.processes ?? [];
  return arr.map((p: Record<string, unknown>, idx: number) => ({
    pid: String(p.pid || `P${idx + 1}`).toUpperCase(),
    arrivalTime: Number(p.arrivalTime) || 0,
    burstTime: Number(p.burstTime) || 1,
    priority: p.priority != null ? Number(p.priority) : undefined,
    color: String(p.color || COLOR_PALETTE[idx % COLOR_PALETTE.length]),
  }));
}

function validateImport(processes: Process[]): { errors: ImportError[]; duplicatePids: string[] } {
  const errors: ImportError[] = [];
  const pids = new Set<string>();
  const duplicates: string[] = [];

  processes.forEach((p, idx) => {
    const err = validateProcessInput(p);
    if (err) {
      errors.push({ row: idx + 1, field: 'process', message: err });
    }
    if (pids.has(p.pid)) {
      duplicates.push(p.pid);
    }
    pids.add(p.pid);
  });

  return { errors, duplicatePids: duplicates };
}

export const ProcessControlCenter: React.FC<ProcessControlCenterProps> = ({
  processes,
  onAddProcess,
  onRemoveProcess,
  onClearAll,
  onResetDefault,
  onGenerateRandom,
  onImportProcesses,
}) => {
  const [pid, setPid] = useState(`P${processes.length + 1}`);
  const [arrivalTime, setArrivalTime] = useState(0);
  const [burstTime, setBurstTime] = useState(4);
  const [priority, setPriority] = useState(1);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[processes.length % COLOR_PALETTE.length]);
  const [pidError, setPidError] = useState('');
  const [arrivalError, setArrivalError] = useState('');
  const [burstError, setBurstError] = useState('');
  const [importError, setImportError] = useState('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [showRandomSliders, setShowRandomSliders] = useState(false);
  const [randCount, setRandCount] = useState(5);
  const [randBurstMin, setRandBurstMin] = useState(2);
  const [randBurstMax, setRandBurstMax] = useState(10);
  const [randArrivalSpread, setRandArrivalSpread] = useState(8);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFieldBlur = () => {
    setPidError('');
    setArrivalError('');
    setBurstError('');

    if (!pid.trim()) {
      setPidError('Process ID is required.');
    } else if (processes.some((p) => p.pid === pid.trim().toUpperCase()) && pid.trim().toUpperCase() !== '') {
      setPidError(`"${pid.trim().toUpperCase()}" already exists.`);
    }
    if (arrivalTime < 0) {
      setArrivalError('Cannot be negative.');
    }
    if (burstTime <= 0) {
      setBurstError('Must be greater than zero.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFieldBlur();
    if (pidError || arrivalError || burstError) return;

    const trimmedPid = pid.trim().toUpperCase();
    if (!trimmedPid) {
      setPidError('Process ID is required.');
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

  const handleExportJSON = () => {
    const data = JSON.stringify(processes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workload.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const header = 'pid,arrivalTime,burstTime,priority';
    const rows = processes.map((p) => `${p.pid},${p.arrivalTime},${p.burstTime},${p.priority ?? ''}`);
    const data = [header, ...rows].join('\n');
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workload.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let imported: Process[];
        if (file.name.endsWith('.json')) {
          imported = parseJSON(text);
        } else {
          imported = parseCSV(text);
        }

        if (imported.length === 0) {
          setImportError('No valid processes found in file.');
          return;
        }

        const { errors, duplicatePids } = validateImport(imported);
        setPendingImport({ processes: imported, errors, duplicatePids });
      } catch {
        setImportError('Failed to parse file. Check format (JSON or CSV).');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    soundFx.playClick();
    onImportProcesses(pendingImport.processes);
    setPendingImport(null);
  };

  const handleCancelImport = () => {
    soundFx.playClick();
    setPendingImport(null);
  };

  const handleGenerateWithSliders = () => {
    soundFx.playClick();
    const generated: Process[] = Array.from({ length: randCount }).map((_, idx) => ({
      pid: `P${idx + 1}`,
      arrivalTime: idx === 0 ? 0 : Math.floor(Math.random() * randArrivalSpread),
      burstTime: Math.floor(Math.random() * (randBurstMax - randBurstMin + 1)) + randBurstMin,
      priority: Math.floor(Math.random() * 5),
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    }));
    onImportProcesses(generated);
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
            <button className="btn btn-quiet" title="Advanced random generator" onClick={() => { soundFx.playClick(); setShowRandomSliders(!showRandomSliders); }}>
              <DiceIcon /> Custom
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

        {/* Import/Export */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-quiet" style={{ fontSize: 11 }} onClick={handleExportJSON}>
            <DownloadIcon /> JSON
          </button>
          <button className="btn btn-quiet" style={{ fontSize: 11 }} onClick={handleExportCSV}>
            <DownloadIcon /> CSV
          </button>
          <button className="btn btn-quiet" style={{ fontSize: 11 }} onClick={() => fileInputRef.current?.click()}>
            <UploadIcon /> Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleImport} style={{ display: 'none' }} />
        </div>
        {importError && (
          <div style={{ padding: '6px 12px' }}>
            <div className="form-error" style={{ fontSize: 11 }}>
              {importError}
            </div>
          </div>
        )}

        {/* Import confirmation dialog */}
        {pendingImport && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Import {pendingImport.processes.length} process{pendingImport.processes.length !== 1 ? 'es' : ''}?
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
              This will replace your current workload of {processes.length} process{processes.length !== 1 ? 'es' : ''}.
            </div>

            {pendingImport.errors.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>
                  {pendingImport.errors.length} validation error{pendingImport.errors.length !== 1 ? 's' : ''}:
                </div>
                <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
                  {pendingImport.errors.map((err, i) => (
                    <div key={i} style={{ padding: '2px 0' }}>
                      Row {err.row}: {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingImport.duplicatePids.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>
                  Duplicate PIDs: {pendingImport.duplicatePids.join(', ')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={handleConfirmImport}
                disabled={pendingImport.errors.length > 0}
              >
                Confirm import
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={handleCancelImport}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Random workload sliders */}
        {showRandomSliders && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
              Custom random generator
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Processes: <strong>{randCount}</strong>
                <input type="range" min={2} max={12} value={randCount} onChange={(e) => setRandCount(parseInt(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Burst min: <strong>{randBurstMin}</strong>
                <input type="range" min={1} max={10} value={randBurstMin} onChange={(e) => setRandBurstMin(parseInt(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Burst max: <strong>{randBurstMax}</strong>
                <input type="range" min={2} max={20} value={randBurstMax} onChange={(e) => setRandBurstMax(parseInt(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Arrival spread: <strong>{randArrivalSpread}</strong>
                <input type="range" min={1} max={20} value={randArrivalSpread} onChange={(e) => setRandArrivalSpread(parseInt(e.target.value))} style={{ width: '100%' }} />
              </label>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={handleGenerateWithSliders}>
              <DiceIcon /> Generate
            </button>
          </div>
        )}

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
            <input id="pid-field" className={`input ${pidError ? 'input-error' : ''}`} value={pid} onChange={(e) => { setPid(e.target.value); setPidError(''); }} onBlur={handleFieldBlur} placeholder="e.g. P5" />
            {pidError && <div className="field-error">{pidError}</div>}
          </div>

          <div className="field-grid-3">
            <div className="field">
              <label className="field-label" htmlFor="arr-field">Arrival</label>
              <input id="arr-field" className={`input ${arrivalError ? 'input-error' : ''}`} type="number" min={0} value={arrivalTime} onChange={(e) => { setArrivalTime(parseInt(e.target.value, 10) || 0); setArrivalError(''); }} onBlur={handleFieldBlur} />
              {arrivalError && <div className="field-error">{arrivalError}</div>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="burst-field">Burst</label>
              <input id="burst-field" className={`input ${burstError ? 'input-error' : ''}`} type="number" min={1} value={burstTime} onChange={(e) => { setBurstTime(parseInt(e.target.value, 10) || 1); setBurstError(''); }} onBlur={handleFieldBlur} />
              {burstError && <div className="field-error">{burstError}</div>}
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

          <button type="submit" className="btn btn-primary btn-block">
            <PlusIcon /> Add process
          </button>
        </form>
      </div>
    </>
  );
};
