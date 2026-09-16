import React, { useRef, useEffect } from 'react';
import { PRESET_WORKLOADS } from '../data/presets';
import { PresetWorkload } from '../types';

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetWorkload) => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({ isOpen, onClose, onSelectPreset }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <dialog ref={ref} className="modal-dialog" onClose={onClose} aria-label="Preset workloads">
      <div className="modal-head">
        <div>
          <div className="modal-title">Preset workloads</div>
          <div className="modal-sub">Educational scenarios for exploring scheduling behavior.</div>
        </div>
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">
        <div className="preset-list">
          {PRESET_WORKLOADS.map((preset) => (
            <div
              key={preset.id}
              className="preset-item"
              onClick={() => { onSelectPreset(preset); onClose(); }}
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
    </dialog>
  );
};
