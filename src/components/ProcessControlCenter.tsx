import { useState, useRef } from 'react';
import { Process } from '../types';
import { soundFx } from '../utils/audio';
import { validateProcessInput } from '../engine/scheduler';
import { COLORS } from './Header';
import { downloadFile } from '../utils/chartUtils';

interface ProcessControlCenterProps {
  processes: Process[];
  onAddProcess: (process: Process) => void;
  onUpdateProcess: (originalPid: string, updated: Process) => void;
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

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
      return { pid: pid.toUpperCase(), arrivalTime, burstTime, priority, color: COLORS[idx % COLORS.length] };
    });
}

function parseJSON(text: string): Process[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.processes ?? [];
  return arr.map((p: Record<string, unknown>, idx: number) => ({
    pid: String(p.pid || `P${idx + 1}`).toUpperCase(),
    arrivalTime: typeof p.arrivalTime === 'number' ? p.arrivalTime : 0,
    burstTime: typeof p.burstTime === 'number' ? p.burstTime : 1,
    priority: p.priority != null && typeof p.priority === 'number' ? p.priority : undefined,
    color: String(p.color || COLORS[idx % COLORS.length]),
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
  onUpdateProcess,
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
  const [selectedColor, setSelectedColor] = useState(COLORS[processes.length % COLORS.length]);
  const [editingPid, setEditingPid] = useState<string | null>(null);
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

  const resetForm = () => {
    setEditingPid(null);
    setPid(`P${processes.length + 1}`);
    setArrivalTime(0);
    setBurstTime(4);
    setPriority(1);
    setSelectedColor(COLORS[processes.length % COLORS.length]);
    setPidError('');
    setArrivalError('');
    setBurstError('');
  };

  const beginEdit = (p: Process) => {
    soundFx.playClick();
    setEditingPid(p.pid);
    setPid(p.pid);
    setArrivalTime(p.arrivalTime);
    setBurstTime(p.burstTime);
    setPriority(p.priority ?? 1);
    setSelectedColor(p.color ?? COLORS[0]);
    setPidError('');
    setArrivalError('');
    setBurstError('');
  };

  // Pure so submit does not depend on the previous render's error state:
  // submitting with Enter fires no blur, so a queued setState would be stale.
  const validate = (pidValue: string, arrival: number, burst: number) => {
    const errors: { pid?: string; arrival?: string; burst?: string } = {};
    const trimmed = pidValue.trim().toUpperCase();
    if (!trimmed) {
      errors.pid = 'Process ID is required.';
    } else if (trimmed !== editingPid && processes.some((p) => p.pid === trimmed)) {
      errors.pid = `"${trimmed}" already exists.`;
    }
    if (arrival < 0) errors.arrival = 'Cannot be negative.';
    if (burst <= 0) errors.burst = 'Must be greater than zero.';
    return errors;
  };

  const showErrors = (errors: { pid?: string; arrival?: string; burst?: string }) => {
    setPidError(errors.pid ?? '');
    setArrivalError(errors.arrival ?? '');
    setBurstError(errors.burst ?? '');
    return errors;
  };

  const handleFieldBlur = () => {
    showErrors(validate(pid, arrivalTime, burstTime));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = showErrors(validate(pid, arrivalTime, burstTime));
    if (errors.pid || errors.arrival || errors.burst) return;

    soundFx.playClick();
    const next: Process = {
      pid: pid.trim().toUpperCase(),
      arrivalTime,
      burstTime,
      priority,
      color: selectedColor,
    };
    if (editingPid) onUpdateProcess(editingPid, next);
    else onAddProcess(next);
    resetForm();
  };

  const handleExportJSON = () => downloadFile(JSON.stringify(processes, null, 2), 'workload.json', 'application/json');
  const handleExportCSV = () => {
    const header = 'pid,arrivalTime,burstTime,priority';
    const rows = processes.map((p) => `${p.pid},${p.arrivalTime},${p.burstTime},${p.priority ?? ''}`);
    downloadFile([header, ...rows].join('\n'), 'workload.csv', 'text/csv');
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
      color: COLORS[idx % COLORS.length],
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
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
              <div key={p.pid} className={`proc-row ${editingPid === p.pid ? 'proc-row-active' : ''}`}>
                <span className="proc-dot" style={{ background: p.color ?? '#2154f0' }} />
                <button
                  type="button"
                  className="proc-row-info proc-row-edit"
                  aria-label={`Edit ${p.pid}, arrival ${p.arrivalTime}, burst ${p.burstTime}`}
                  onClick={() => beginEdit(p)}
                >
                  <div className="proc-name">{p.pid}</div>
                  <div className="proc-meta">
                    arr {p.arrivalTime} · burst {p.burstTime} · pri {p.priority ?? '–'}
                  </div>
                </button>
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
            {editingPid ? <PencilIcon /> : <PlusIcon />}
            <span>{editingPid ? `Edit ${editingPid}` : 'New process'}</span>
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
              {COLORS.map((c) => (
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

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-block">
              {editingPid ? (
                <>
                  <PencilIcon /> Save changes
                </>
              ) : (
                <>
                  <PlusIcon /> Add process
                </>
              )}
            </button>
            {editingPid && (
              <button type="button" className="btn btn-ghost" onClick={() => { soundFx.playClick(); resetForm(); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
};
