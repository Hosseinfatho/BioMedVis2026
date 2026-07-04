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

  return (
    <div className="control-panel">
      <div className="control-group">
        <h3>System selection</h3>
        {Object.entries(SYSTEMS).map(([id, sys]) => (
          <label key={id} className="control-checkbox">
            <input
              type="checkbox"
              checked={selectedSystems.includes(id)}
              onChange={() => toggleSystem(id)}
            />
            {sys.label} <span className="control-id">= {id}</span>
          </label>
        ))}
      </div>

      <div className="control-group">
        <h3>State model</h3>
        {Object.entries(MODELS).map(([id, model]) => (
          <label key={id} className="control-radio">
            <input
              type="radio"
              name="state-model"
              checked={selectedModel === id}
              onChange={() => onModelChange(id)}
            />
            {model.label}
          </label>
        ))}
      </div>

      <div className="control-group">
        <h3>Trajectory view</h3>
        {Object.entries(VIEW_MODES).map(([id, mode]) => (
          <label key={id} className="control-radio">
            <input
              type="radio"
              name="view-mode"
              checked={viewMode === id}
              onChange={() => onViewModeChange(id)}
            />
            {mode.label}
          </label>
        ))}
      </div>

      <div className="control-group control-actions">
        <button
          type="button"
          className="generate-btn"
          onClick={onGenerate}
          disabled={loading || selectedSystems.length === 0}
        >
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
