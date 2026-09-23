import { useEffect, useMemo, useRef, useState } from 'react';
import { AlgorithmType } from '../types';
import { ALGORITHMS } from './Header';
import { PRESET_WORKLOADS } from '../data/presets';

export type PaletteAction =
  | { kind: 'algorithm'; id: AlgorithmType; label: string }
  | { kind: 'view'; id: 'visualizer' | 'comparison' | 'race' | 'experiment' | 'learning' | 'interview'; label: string }
  | { kind: 'preset'; id: string; label: string }
  | { kind: 'cmd'; id: 'share' | 'shortcuts' | 'clear' | 'reset' | 'report'; label: string };

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRun: (action: PaletteAction) => void;
}

export const CommandPalette = ({ open, onClose, onRun }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<PaletteAction[]>(() => {
    const algos: PaletteAction[] = ALGORITHMS.map((a) => ({
      kind: 'algorithm', id: a.id, label: `Algorithm: ${a.name}`,
    }));
    const views: PaletteAction[] = [
      { kind: 'view', id: 'visualizer', label: 'View: Visualizer' },
      { kind: 'view', id: 'comparison', label: 'View: Benchmark' },
      { kind: 'view', id: 'race', label: 'View: Race' },
      { kind: 'view', id: 'experiment', label: 'View: Experiment lab' },
      { kind: 'view', id: 'learning', label: 'View: Learning mode' },
      { kind: 'view', id: 'interview', label: 'View: Interview mode' },
    ];
    const presets: PaletteAction[] = PRESET_WORKLOADS.map((p) => ({
      kind: 'preset', id: p.id, label: `Preset: ${p.name}`,
    }));
    const cmds: PaletteAction[] = [
      { kind: 'cmd', id: 'share', label: 'Command: Copy share URL' },
      { kind: 'cmd', id: 'report', label: 'Command: Download Markdown report' },
      { kind: 'cmd', id: 'shortcuts', label: 'Command: Keyboard shortcuts' },
      { kind: 'cmd', id: 'reset', label: 'Command: Reset default workload' },
      { kind: 'cmd', id: 'clear', label: 'Command: Clear all processes' },
    ];
    return [...views, ...algos, ...presets, ...cmds];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const run = (a: PaletteAction) => {
    onRun(a);
    onClose();
  };

  return (
    <div
      className="palette-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command, algorithm, or preset…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(filtered.length - 1, i + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === 'Enter' && filtered[index]) {
              e.preventDefault();
              run(filtered[index]);
            }
          }}
        />
        <div className="palette-list" role="listbox">
          {filtered.length === 0 && (
            <div className="palette-empty">No matches</div>
          )}
          {filtered.map((a, i) => (
            <button
              key={`${a.kind}-${'id' in a ? a.id : i}`}
              className={`palette-item ${i === index ? 'active' : ''}`}
              onClick={() => run(a)}
              role="option"
              aria-selected={i === index}
              type="button"
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};
