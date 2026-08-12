import React from 'react';
import { PRESET_WORKLOADS } from '../data/presets';
import { PresetWorkload } from '../types';

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetWorkload) => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const PresetsModal: React.FC<PresetsModalProps> = ({ isOpen, onClose, onSelectPreset }) => {
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Preset workloads">
        <div className="modal-head">
          <div>
            <div className="modal-title">Preset workloads</div>
            <div className="modal-sub">Educational scenarios for exploring scheduling behavior.</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="preset-list">
            {PRESET_WORKLOADS.map((preset) => (
              <div
                key={preset.id}
                className="preset-item"
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
              >
                <div className="preset-top">
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-count">{preset.processes.length} processes</span>
                </div>
                <div className="preset-desc">{preset.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};