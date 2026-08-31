import { useState, useEffect, useMemo, useCallback } from 'react';
import { Process, AlgorithmType, SimulationResult, PresetWorkload } from './types';
import { runAlgorithm, runMultiCore } from './engine/scheduler';
import { PRESET_WORKLOADS } from './data/presets';
import { soundFx } from './utils/audio';
import { encodeStateToURL, decodeStateFromURL } from './utils/shareUrl';

import { Header, ALGORITHMS } from './components/Header';
import { CpuMonitorHud } from './components/CpuMonitorHud';
import { ReadyQueueHud } from './components/ReadyQueueHud';
import { ProcessControlCenter } from './components/ProcessControlCenter';
import { GanttChart } from './components/GanttChart';
import { PlaybackControls } from './components/PlaybackControls';
import { MetricsCards } from './components/MetricsCards';
import { ProcessResultsTable } from './components/ProcessResultsTable';
import { AlgorithmLeaderboard } from './components/AlgorithmLeaderboard';
import { RaceMode } from './components/RaceMode';
import { ExplanationBar } from './components/ExplanationBar';
import { PresetsModal } from './components/PresetsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

const RANDOM_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

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
  const [viewMode, setViewMode] = useState<'visualizer' | 'comparison' | 'race'>('visualizer');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
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

  const simulationResult: SimulationResult = useMemo(() => {
    if (processes.length === 0) return EMPTY_RESULT;
    try {
      const singleCore = runAlgorithm(algorithm, processes, { quantum });
      return runMultiCore(singleCore, coreCount);
    } catch (err) {
      console.error('Simulation calculation error:', err);
      return EMPTY_RESULT;
    }
  }, [processes, algorithm, quantum, coreCount]);

  const maxTime = useMemo(() => {
    if (simulationResult.timeline.length === 0) return 0;
    return simulationResult.timeline[simulationResult.timeline.length - 1].end;
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
        setViewMode((prev) => (prev === 'visualizer' ? 'comparison' : prev === 'comparison' ? 'race' : 'visualizer'));
      } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
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
    const count = Math.floor(Math.random() * 3) + 4;
    const generated: Process[] = Array.from({ length: count }).map((_, idx) => ({
      pid: `P${idx + 1}`,
      arrivalTime: idx === 0 ? 0 : Math.floor(Math.random() * 8),
      burstTime: Math.floor(Math.random() * 8) + 2,
      priority: Math.floor(Math.random() * 5),
      color: RANDOM_COLORS[idx % RANDOM_COLORS.length],
    }));
    setProcesses(generated);
  };

  const handleSelectPreset = (preset: PresetWorkload) => {
    setProcesses(preset.processes);
    if (preset.defaultAlgorithm) setAlgorithm(preset.defaultAlgorithm);
    if (preset.defaultQuantum) setQuantum(preset.defaultQuantum);
    setViewMode('visualizer');
  };

  const handleShare = useCallback(() => {
    const url = encodeStateToURL({ processes, algorithm, quantum, coreCount });
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {
      // Fallback: copy to a temp input
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [processes, algorithm, quantum, coreCount]);

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
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          setSoundEnabled(!soundEnabled);
          soundFx.enabled = !soundEnabled;
        }}
        shareCopied={shareCopied}
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
          {viewMode === 'visualizer' ? (
            <div className="main-flow">
              <CpuMonitorHud timeline={simulationResult.timeline} processes={processes} currentTimeStep={currentTimeStep} />
              <MetricsCards result={simulationResult} />
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
                currentTimeStep={currentTimeStep}
                maxTime={maxTime}
                speed={playbackSpeed}
                onChangeSpeed={setPlaybackSpeed}
              />
              <GanttChart timeline={simulationResult.timeline} processes={processes} currentTimeStep={currentTimeStep} coreCount={coreCount} />
              <ExplanationBar timeline={simulationResult.timeline} processes={processes} algorithm={algorithm} currentTimeStep={currentTimeStep} />
              <ProcessResultsTable results={simulationResult.processResults} processes={processes} />
            </div>
          ) : viewMode === 'comparison' ? (
            <AlgorithmLeaderboard
              processes={processes}
              quantum={quantum}
              onSelectAlgorithm={(alg) => {
                setAlgorithm(alg);
                setViewMode('visualizer');
              }}
            />
          ) : (
            <RaceMode
              processes={processes}
              quantum={quantum}
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
      {isOnboardingOpen && (
        <OnboardingModal onClose={() => {
          setIsOnboardingOpen(false);
          try { localStorage.setItem('toy-scheduler-onboarded', '1'); } catch {}
        }} />
      )}
    </div>
  );
}