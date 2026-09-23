import { useState, useEffect, useMemo, useCallback } from 'react';
import { Process, AlgorithmType, SimulationResult, PresetWorkload } from './types';
import { runAlgorithm } from './engine/runAlgorithm';
import { PRESET_WORKLOADS } from './data/presets';
import { soundFx } from './utils/audio';
import { encodeStateToURL, decodeStateFromURL } from './utils/shareUrl';

import { Header, ALGORITHMS } from './components/Header';
import { CpuMonitorHud } from './components/CpuMonitorHud';
import { ReadyQueueHud } from './components/ReadyQueueHud';
import { ProcessControlCenter } from './components/ProcessControlCenter';
import { GanttChart } from './components/GanttChart';
import { PlaybackControls } from './components/PlaybackControls';
import { ProcessResultsTable } from './components/ProcessResultsTable';
import { AlgorithmLeaderboard } from './components/AlgorithmLeaderboard';
import { RaceMode } from './components/RaceMode';
import { ExplanationBar } from './components/ExplanationBar';
import { StateBoard } from './components/StateBoard';
import { ExperimentLab } from './components/ExperimentLab';
import { CommandPalette, PaletteAction } from './components/CommandPalette';
import { generateWorkload } from './utils/workload';
import { PresetsModal } from './components/PresetsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

const EMPTY_RESULT: SimulationResult = {
  timeline: [],
  processResults: [],
  averageWaitingTime: 0,
  averageTurnaroundTime: 0,
  averageResponseTime: 0,
};

export default function App() {
  const urlState = useMemo(() => decodeStateFromURL(), []);

  const [processes, setProcesses] = useState<Process[]>(urlState?.processes ?? PRESET_WORKLOADS[0].processes);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>(urlState?.algorithm ?? 'fifo');
  const [quantum, setQuantum] = useState<number>(urlState?.quantum ?? 2);
  const [coreCount, setCoreCount] = useState<number>(urlState?.coreCount ?? 1);
  const [contextSwitchCost, setContextSwitchCost] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'visualizer' | 'comparison' | 'race' | 'experiment'>('visualizer');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [shareUrlTooLong, setShareUrlTooLong] = useState<boolean>(false);

  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('toy-scheduler-onboarded');
    } catch {
      return true;
    }
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeStep, setCurrentTimeStep] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [simError, setSimError] = useState<string | null>(null);

  const simulationResult: SimulationResult = useMemo(() => {
    if (processes.length === 0) return EMPTY_RESULT;
    try {
      return runAlgorithm(algorithm, processes, { quantum, coreCount, contextSwitchCost });
    } catch {
      return EMPTY_RESULT;
    }
  }, [processes, algorithm, quantum, coreCount, contextSwitchCost]);

  useEffect(() => {
    if (processes.length === 0) { setSimError(null); return; }
    try {
      runAlgorithm(algorithm, processes, { quantum, coreCount, contextSwitchCost });
      setSimError(null);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Unknown simulation error');
    }
  }, [processes, algorithm, quantum, coreCount, contextSwitchCost]);

  const maxTime = useMemo(() => {
    if (simulationResult.timeline.length === 0) return 0;
    return Math.max(...simulationResult.timeline.map((s) => s.end));
  }, [simulationResult]);

  // Reset playback when simulation inputs change
  useEffect(() => {
    setCurrentTimeStep(0);
    setIsPlaying(false);
  }, [processes, algorithm, quantum]);

  // Animation loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      const stepMs = Math.max(80, 450 / playbackSpeed);
      interval = setInterval(() => {
        setCurrentTimeStep((prev) => {
          if (prev >= maxTime) {
            setIsPlaying(false);
            soundFx.playPause();
            return maxTime;
          }
          soundFx.playStep();
          return prev + 1;
        });
      }, stepMs);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, maxTime, playbackSpeed]);

  const handleTogglePlay = useCallback(() => {
    if (currentTimeStep >= maxTime) setCurrentTimeStep(0);
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) soundFx.playPlay();
      else soundFx.playPause();
      return next;
    });
  }, [currentTimeStep, maxTime]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes((e.target as HTMLElement).tagName)) return;
      // Never hijack shortcuts when modifier keys are held (browser shortcuts: refresh/copy/tab-switch…)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        soundFx.playStep();
        setCurrentTimeStep((prev) => Math.max(0, prev - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        soundFx.playStep();
        setCurrentTimeStep((prev) => Math.min(maxTime, prev + 1));
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsPlaying(false);
        soundFx.playClick();
        setCurrentTimeStep(0);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        soundFx.playClick();
        setViewMode((prev) => {
          const order: Array<'visualizer' | 'comparison' | 'race' | 'experiment'> = ['visualizer', 'comparison', 'race', 'experiment'];
          const idx = order.indexOf(prev);
          return order[(idx + 1) % order.length];
        });
      } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (ALGORITHMS[index]) {
          soundFx.playClick();
          setAlgorithm(ALGORITHMS[index].id);
          setViewMode('visualizer');
        }
      } else if (e.shiftKey && ['!', '@', '#', '$', '%', '^', '&', '*', '('].includes(e.key)) {
        const shiftMap: Record<string, number> = { '!': 1, '@': 2, '#': 3, '$': 4, '%': 5, '^': 6, '&': 7, '*': 8, '(': 9 };
        const index = shiftMap[e.key] + 8; // algorithms 10–17 via shift+digit
        if (ALGORITHMS[index]) {
          soundFx.playClick();
          setAlgorithm(ALGORITHMS[index].id);
          setViewMode('visualizer');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, maxTime]);

  const handleAddProcess = (p: Process) => setProcesses((prev) => [...prev, p]);
  const handleRemoveProcess = (pid: string) => setProcesses((prev) => prev.filter((p) => p.pid !== pid));
  const handleClearAll = () => setProcesses([]);
  const handleImportProcesses = (imported: Process[]) => setProcesses(imported);

  const handleResetDefault = () => {
    setProcesses(PRESET_WORKLOADS[0].processes);
    setAlgorithm('fifo');
  };

  const handleGenerateRandom = () => {
    setProcesses(generateWorkload('classic', 4 + Math.floor(Math.random() * 3)));
  };

  const handleSelectPreset = (preset: PresetWorkload) => {
    setProcesses(preset.processes);
    if (preset.defaultAlgorithm) setAlgorithm(preset.defaultAlgorithm);
    if (preset.defaultQuantum) setQuantum(preset.defaultQuantum);
    setViewMode('visualizer');
  };

  const handleShare = useCallback(() => {
    const url = encodeStateToURL({ processes, algorithm, quantum, coreCount });
    if (!url) {
      setShareUrlTooLong(true);
      setShareCopied(false);
      setTimeout(() => setShareUrlTooLong(false), 3000);
      return;
    }
    setShareUrlTooLong(false);
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [processes, algorithm, quantum, coreCount]);

  const handlePaletteAction = useCallback((action: PaletteAction) => {
    if (action.kind === 'algorithm') setAlgorithm(action.id);
    if (action.kind === 'view') setViewMode(action.id as typeof viewMode);
    if (action.kind === 'preset') {
      const p = PRESET_WORKLOADS.find((x) => x.id === action.id);
      if (p) handleSelectPreset(p);
    }
    if (action.kind === 'cmd') {
      if (action.id === 'share') handleShare();
      if (action.id === 'shortcuts') setIsShortcutsOpen(true);
      if (action.id === 'clear') setProcesses([]);
      if (action.id === 'reset') {
        setProcesses(PRESET_WORKLOADS[0].processes);
        setAlgorithm('fifo');
      }
    }
  }, [handleShare]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Header
        selectedAlgorithm={algorithm}
        onSelectAlgorithm={setAlgorithm}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        quantum={quantum}
        onChangeQuantum={setQuantum}
        coreCount={coreCount}
        onChangeCoreCount={setCoreCount}
        contextSwitchCost={contextSwitchCost}
        onChangeContextSwitchCost={setContextSwitchCost}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          setSoundEnabled(!soundEnabled);
          soundFx.enabled = !soundEnabled;
        }}
        shareCopied={shareCopied}
        shareUrlTooLong={shareUrlTooLong}
        onShare={handleShare}
      />

      <div className="workspace">
        <aside className="sidebar">
          <ProcessControlCenter
            processes={processes}
            onAddProcess={handleAddProcess}
            onRemoveProcess={handleRemoveProcess}
            onClearAll={handleClearAll}
            onResetDefault={handleResetDefault}
            onGenerateRandom={handleGenerateRandom}
            onImportProcesses={handleImportProcesses}
          />
          <ReadyQueueHud timeline={simulationResult.timeline} processes={processes} currentTimeStep={currentTimeStep} />
        </aside>

        <main className="main">
          {simError && (
            <div className="form-error" style={{ marginBottom: 12, fontSize: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12" y2="16" />
              </svg>
              <span><strong>Simulation error:</strong> {simError}</span>
              <button
                className="btn btn-quiet"
                style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 6px' }}
                onClick={() => setSimError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          {viewMode === 'visualizer' ? (
            <div className="main-flow">
              <CpuMonitorHud timeline={simulationResult.timeline} processes={processes} currentTimeStep={currentTimeStep} />
              <div className="stat-grid">
                {(() => {
                  const { averageWaitingTime, averageTurnaroundTime, averageResponseTime, timeline, metrics } = simulationResult;
                  const totalSpan = timeline.length > 0 ? Math.max(...timeline.map((s) => s.end)) : 0;
                  const idleSpan = timeline.filter((s) => s.pid === 'idle').reduce((sum, s) => sum + (s.end - s.start), 0);
                  const csSpan = timeline.filter((s) => s.kind === 'CONTEXT_SWITCH').reduce((sum, s) => sum + (s.end - s.start), 0);
                  const busySpan = totalSpan - idleSpan - csSpan;
                  const cpuUtilization = totalSpan > 0 ? (busySpan / (totalSpan * coreCount)) * 100 : 0;
                  return [
                    { label: 'Avg waiting', value: averageWaitingTime.toFixed(2), unit: 'ms', accent: 'var(--accent)', foot: 'Lower is better' },
                    { label: 'Turnaround', value: averageTurnaroundTime.toFixed(2), unit: 'ms', accent: 'var(--text-1)', foot: 'Completion − arrival' },
                    { label: 'Response', value: averageResponseTime.toFixed(2), unit: 'ms', accent: 'var(--text-1)', foot: 'First CPU acquisition' },
                    { label: 'CPU utilization', value: cpuUtilization.toFixed(1), unit: '%', accent: 'var(--green)', foot: 'Busy / total span' },
                    { label: 'Throughput', value: (metrics?.throughput ?? 0).toFixed(3), unit: '/ms', accent: 'var(--text-2)', foot: 'Processes per ms' },
                    { label: 'Fairness', value: (metrics?.jainFairness ?? 1).toFixed(3), unit: '', accent: 'var(--text-2)', foot: "Jain's index" },
                    { label: 'Context switches', value: String(metrics?.contextSwitchCount ?? 0), unit: '', accent: 'var(--amber)', foot: 'Dispatch overhead' },
                    { label: 'Wait p95', value: (metrics?.waitingP95 ?? 0).toFixed(2), unit: 'ms', accent: 'var(--text-2)', foot: 'Tail waiting' },
                  ].map((s) => (
                    <div key={s.label} className="stat" style={{ '--stat-accent': s.accent } as React.CSSProperties}>
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value">{s.value}<span className="stat-unit">{s.unit}</span></div>
                      <div className="stat-foot">{s.foot}</div>
                    </div>
                  ));
                })()}
              </div>
              <PlaybackControls
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                onStepBack={() => {
                  setIsPlaying(false);
                  soundFx.playStep();
                  setCurrentTimeStep((prev) => Math.max(0, prev - 1));
                }}
                onStepForward={() => {
                  setIsPlaying(false);
                  soundFx.playStep();
                  setCurrentTimeStep((prev) => Math.min(maxTime, prev + 1));
                }}
                onReset={() => {
                  setIsPlaying(false);
                  soundFx.playClick();
                  setCurrentTimeStep(0);
                }}
                onJumpToEvent={(dir) => {
                  setIsPlaying(false);
                  soundFx.playStep();
                  const starts = Array.from(new Set(simulationResult.timeline.map((s) => s.start)))
                    .concat(simulationResult.timeline.map((s) => s.end))
                    .filter((t) => t >= 0)
                    .sort((a, b) => a - b);
                  const unique = Array.from(new Set(starts));
                  if (dir === 'next') {
                    const next = unique.find((t) => t > currentTimeStep);
                    if (next != null) setCurrentTimeStep(Math.min(next, maxTime));
                  } else {
                    const prevs = unique.filter((t) => t < currentTimeStep);
                    if (prevs.length > 0) setCurrentTimeStep(prevs[prevs.length - 1]);
                  }
                }}
                onSeek={(t) => {
                  setIsPlaying(false);
                  setCurrentTimeStep(Math.max(0, Math.min(maxTime, t)));
                }}
                currentTimeStep={currentTimeStep}
                maxTime={maxTime}
                speed={playbackSpeed}
                onChangeSpeed={setPlaybackSpeed}
              />
              <GanttChart timeline={simulationResult.timeline} processes={processes} currentTimeStep={currentTimeStep} coreCount={coreCount} />
              <ExplanationBar timeline={simulationResult.timeline} processes={processes} algorithm={algorithm} currentTimeStep={currentTimeStep} />
              <ProcessResultsTable results={simulationResult.processResults} processes={processes} />
              <StateBoard timeline={simulationResult.timeline} processes={processes} currentTimeStep={currentTimeStep} />
            </div>
          ) : viewMode === 'comparison' ? (
            <AlgorithmLeaderboard
              processes={processes}
              quantum={quantum}
              contextSwitchCost={contextSwitchCost}
              onSelectAlgorithm={(alg) => {
                setAlgorithm(alg);
                setViewMode('visualizer');
              }}
            />
          ) : viewMode === 'experiment' ? (
            <ExperimentLab
              processes={processes}
              algorithm={algorithm}
              contextSwitchCost={contextSwitchCost}
              coreCount={coreCount}
            />
          ) : (
            <RaceMode
              processes={processes}
              quantum={quantum}
              contextSwitchCost={contextSwitchCost}
              currentTimeStep={currentTimeStep}
              onSelectAlgorithm={(alg) => {
                setAlgorithm(alg);
                setViewMode('visualizer');
              }}
            />
          )}
        </main>
      </div>

      <PresetsModal isOpen={isPresetsOpen} onClose={() => setIsPresetsOpen(false)} onSelectPreset={handleSelectPreset} />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <CommandPalette open={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onRun={handlePaletteAction} />
      {isOnboardingOpen && (
        <OnboardingModal onClose={() => {
          setIsOnboardingOpen(false);
          try { localStorage.setItem('toy-scheduler-onboarded', '1'); } catch { /* storage unavailable */ return false; }
        }} />
      )}
    </div>
  );
}