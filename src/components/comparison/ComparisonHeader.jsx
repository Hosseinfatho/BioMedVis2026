import { SYSTEMS, MODELS, VIEW_MODES } from '../../config/dataFiles';

export default function ComparisonHeader({
  systemId,
  rowCount,
  viewMode,
  modelId,
}) {
  return (
    <div className="comparison-header">
      <h2>
        {SYSTEMS[systemId].label}
        <span className="system-meta">
          {systemId} · {rowCount}{' '}
          {viewMode === 'concatenated' ? 'paths' : 'trajectories'} ·{' '}
          {VIEW_MODES[viewMode].label} · {MODELS[modelId].label}
        </span>
      </h2>
    </div>
  );
}
