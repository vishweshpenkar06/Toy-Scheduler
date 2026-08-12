import React from 'react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onReset: () => void;
  currentTimeStep: number;
  maxTime: number;
  speed: number;
  onChangeSpeed: (speed: number) => void;
}

const SkipIcon = ({ direction }: { direction: 'back' | 'fwd' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {direction === 'back' ? (
      <>
        <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
        <line x1="5" y1="19" x2="5" y2="5" />
      </>
    ) : (
      <>
        <polygon points="5 19 15 12 5 5 5 19" fill="currentColor" stroke="none" />
        <line x1="19" y1="5" x2="19" y2="19" />
      </>
    )}
  </svg>
);

const ResetIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4h4" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="4" width="5" height="16" rx="1" />
    <rect x="14" y="4" width="5" height="16" rx="1" />
  </svg>
);

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onReset,
  currentTimeStep,
  maxTime,
  speed,
  onChangeSpeed,
}) => {
  return (
    <div className="transport">
      <div className="transport-group">
        <button className="tbtn" onClick={onReset} title="Reset to start (t = 0)">
          <ResetIcon />
        </button>
        <button className="tbtn" onClick={onStepBack} disabled={currentTimeStep <= 0} title="Step back 1 ms">
          <SkipIcon direction="back" />
        </button>
        <button className="tbtn play" onClick={onTogglePlay} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="tbtn" onClick={onStepForward} disabled={currentTimeStep >= maxTime} title="Step forward 1 ms">
          <SkipIcon direction="fwd" />
        </button>
      </div>

      <div className="transport-info">
        <strong>{currentTimeStep}</strong> / {maxTime} ms
      </div>

      <div className="transport-right">
        <label className="speed-label" htmlFor="speed-select">Speed</label>
        <select id="speed-select" className="select" value={speed} onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}>
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>
    </div>
  );
};