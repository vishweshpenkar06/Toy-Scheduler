import React from 'react';
import { AlgorithmType, AlgorithmInfo } from '../types';
import { soundFx } from '../utils/audio';

export const ALGORITHMS: AlgorithmInfo[] = [
  { id: 'fifo', name: 'FCFS', shortName: 'FCFS', description: 'First-Come First-Served (non-preemptive)', isPreemptive: false },
  { id: 'sjf', name: 'SJF', shortName: 'SJF', description: 'Shortest Job First (non-preemptive)', isPreemptive: false },
  { id: 'srtf', name: 'SRTF', shortName: 'SRTF', description: 'Shortest Remaining Time First (preemptive)', isPreemptive: true },
  { id: 'roundRobin', name: 'Round Robin', shortName: 'RR', description: 'Time-sliced quantum scheduling', isPreemptive: true, requiresQuantum: true },
  { id: 'priorityNonPreemptive', name: 'Priority (NP)', shortName: 'Pri NP', description: 'Priority-based scheduling (non-preemptive)', isPreemptive: false, requiresPriority: true },
  { id: 'priorityPreemptive', name: 'Priority (P)', shortName: 'Pri P', description: 'Priority-based scheduling (preemptive)', isPreemptive: true, requiresPriority: true },
  { id: 'priorityAging', name: 'Priority + Aging', shortName: 'Pri+Aging', description: 'Priority scheduling with aging to prevent starvation', isPreemptive: true, requiresPriority: true },
  { id: 'multiLevelQueue', name: 'Multilevel Queue', shortName: 'MLQ', description: 'Fixed priority queues with FIFO per level', isPreemptive: false },
  { id: 'multiLevelFeedback', name: 'MLFQ', shortName: 'MLFQ', description: 'Multilevel feedback queue with aging and demotion', isPreemptive: true, requiresQuantum: true },
];

interface HeaderProps {
  selectedAlgorithm: AlgorithmType;
  onSelectAlgorithm: (alg: AlgorithmType) => void;
  viewMode: 'visualizer' | 'comparison' | 'race';
  onToggleViewMode: (mode: 'visualizer' | 'comparison' | 'race') => void;
  onOpenPresets: () => void;
  onOpenShortcuts: () => void;
  quantum: number;
  onChangeQuantum: (q: number) => void;
  coreCount: number;
  onChangeCoreCount: (c: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  shareCopied: boolean;
  shareUrlTooLong: boolean;
  onShare: () => void;
}

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
    {muted ? <line x1="22" y1="9" x2="16" y2="15" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
    {muted ? <line x1="16" y1="9" x2="22" y2="15" /> : <path d="M18.5 6a9 9 0 0 1 0 12" />}
  </svg>
);

const BarChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 20V10M12 20V4M18 20v-6" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </svg>
);

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);

const KeyboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  selectedAlgorithm,
  onSelectAlgorithm,
  viewMode,
  onToggleViewMode,
  onOpenPresets,
  onOpenShortcuts,
  quantum,
  onChangeQuantum,
  coreCount,
  onChangeCoreCount,
  soundEnabled,
  onToggleSound,
  shareCopied,
  shareUrlTooLong,
  onShare,
}) => {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">QS</div>
        <div>
          <div className="brand-name">Quantum Scheduler</div>
          <div className="brand-sub">CPU Algorithm Lab</div>
        </div>
      </div>

      <div className="topbar-center">
        <nav className="seg">
          {ALGORITHMS.map((alg, i) => (
            <button
              key={alg.id}
              className={`seg-btn ${selectedAlgorithm === alg.id && viewMode === 'visualizer' ? 'active' : ''}`}
              onClick={() => {
                soundFx.playClick();
                onSelectAlgorithm(alg.id);
                if (viewMode !== 'visualizer') onToggleViewMode('visualizer');
              }}
              title={alg.description}
            >
              <span className="seg-num">{i + 1}</span>
              {alg.shortName}
              {alg.requiresQuantum && <span className="seg-tag">Q</span>}
            </button>
          ))}
        </nav>

        {(selectedAlgorithm === 'roundRobin' || selectedAlgorithm === 'multiLevelFeedback') && viewMode === 'visualizer' && (
          <div className="quantum">
            <label className="quantum-label" htmlFor="quantum-input">Quantum</label>
            <input
              id="quantum-input"
              className="quantum-input"
              type="number"
              min={1}
              max={20}
              value={quantum}
              onChange={(e) => onChangeQuantum(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
        )}

        {viewMode === 'visualizer' && (
          <div className="quantum">
            <label className="quantum-label" htmlFor="core-count">Cores</label>
            <select
              id="core-count"
              className="select"
              value={coreCount}
              onChange={(e) => onChangeCoreCount(parseInt(e.target.value, 10))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        )}
      </div>

      <div className="topbar-right">
        <button
          className="btn btn-ghost"
          onClick={() => { soundFx.playClick(); onShare(); }}
          title="Copy shareable link"
          style={{ fontSize: 12 }}
        >
          {shareUrlTooLong ? 'Too long' : shareCopied ? 'Copied!' : 'Share'}
        </button>
        <button className="icon-btn" onClick={() => { soundFx.playClick(); onOpenPresets(); }} title="Load a preset workload" aria-label="Load a preset workload">
          <FolderIcon />
        </button>
        <button className="icon-btn" onClick={() => { soundFx.playClick(); onOpenShortcuts(); }} title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
          <KeyboardIcon />
        </button>
        <button className="icon-btn" onClick={() => { soundFx.playClick(); onToggleSound(); }} title={soundEnabled ? 'Mute sounds' : 'Enable sounds'} aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
          <SpeakerIcon muted={!soundEnabled} />
        </button>
        <button
          className={viewMode !== 'visualizer' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => {
            soundFx.playClick();
            onToggleViewMode(viewMode === 'visualizer' ? 'comparison' : viewMode === 'comparison' ? 'race' : 'visualizer');
          }}
        >
          {viewMode === 'comparison' ? <GridIcon /> : <BarChartIcon />}
          {viewMode === 'visualizer' ? 'Compare all' : viewMode === 'comparison' ? 'Race' : 'Single view'}
        </button>
      </div>
    </header>
  );
};