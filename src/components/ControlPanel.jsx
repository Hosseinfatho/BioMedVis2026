import { useMemo } from 'react';
import { SYSTEMS, MODELS, VIEW_MODES } from '../config/dataFiles';

export default function ControlPanel({
  selectedSystems,
  onSystemsChange,
  selectedModel,
  onModelChange,
  viewMode,
  onViewModeChange,
  onGenerate,
  loading,
}) {
  const toggleSystem = (id) => {
    if (selectedSystems.includes(id)) {
      onSystemsChange(selectedSystems.filter((s) => s !== id));
    } else {
      onSystemsChange([...selectedSystems, id]);
    }
  };

  const systemsSummary = useMemo(() => {
    if (!selectedSystems.length) return 'Select…';
    if (selectedSystems.length === 1) {
      const id = selectedSystems[0];
      return `${SYSTEMS[id].label} (${id})`;
    }
    return `${selectedSystems.length} systems`;
  }, [selectedSystems]);

  return (
    <div className="control-panel">
      <label className="control-field">
        <span className="control-field-label">Systems</span>
        <details className="control-dropdown">
          <summary className="control-dropdown-trigger">{systemsSummary}</summary>
          <div
            className="control-dropdown-panel"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {Object.entries(SYSTEMS).map(([id, sys]) => (
              <label key={id} className="control-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSystems.includes(id)}
                  onChange={() => toggleSystem(id)}
                />
                {sys.label} <span className="control-id">({id})</span>
              </label>
            ))}
          </div>
        </details>
      </label>

      <label className="control-field">
        <span className="control-field-label">State model</span>
        <select
          className="control-select"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {Object.entries(MODELS).map(([id, model]) => (
            <option key={id} value={id}>
              {model.label}
            </option>
          ))}
        </select>
      </label>

      <label className="control-field">
        <span className="control-field-label">Trajectory view</span>
        <select
          className="control-select"
          value={viewMode}
          onChange={(e) => onViewModeChange(e.target.value)}
        >
          {Object.entries(VIEW_MODES).map(([id, mode]) => (
            <option key={id} value={id}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="generate-btn control-generate-btn"
        onClick={onGenerate}
        disabled={loading || selectedSystems.length === 0}
      >
        {loading ? 'Loading…' : 'Generate'}
      </button>
    </div>
  );
}
