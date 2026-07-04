import TrajectoryRows from '../TrajectoryRows';
import State from '../State';
import ComparisonHeader from './ComparisonHeader';

export default function ComparisonRow({
  systemId,
  rows,
  viewMode,
  modelId,
  numStates,
  selection,
  hoverIndex,
}) {
  return (
    <div className="comparison-row">
      <ComparisonHeader
        systemId={systemId}
        rowCount={rows.length}
        viewMode={viewMode}
        modelId={modelId}
      />
      <div className="comparison-charts">
        <div className="panel-half panel-epoch">
          <TrajectoryRows
            rows={rows}
            viewMode={viewMode}
            selection={selection}
            hoverIndex={hoverIndex}
          />
        </div>
        <div className="panel-half panel-state">
          <State
            rows={rows}
            numStates={numStates}
            viewMode={viewMode}
            selection={selection}
            hoverIndex={hoverIndex}
          />
        </div>
      </div>
    </div>
  );
}
