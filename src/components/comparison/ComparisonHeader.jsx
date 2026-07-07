import { SYSTEMS } from '../../config/dataFiles';

export default function ComparisonHeader({ systemId, rowCount, viewMode }) {
  const unit = viewMode === 'concatenated' ? 'paths' : 'trajectories';

  return (
    <div className="comparison-header">
      <h2>
        {SYSTEMS[systemId].label}
        <span className="system-meta">
          {rowCount} {unit}
        </span>
      </h2>
    </div>
  );
}
