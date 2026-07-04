import TrajectoryRows from '../TrajectoryRows';
import State from '../State';
import ComparisonHeader from './ComparisonHeader';

export default function ComparisonRow({
  systemId,
  rows,
  viewMode,
  originalRows,
  modelId,
  numStates,
  selection,
  hoverIndex,
  matrixSlots,
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
            originalRows={originalRows}
            selection={selection}
            hoverIndex={hoverIndex}
            matrixSlots={matrixSlots}
          />
        </div>
        <div className="panel-half panel-state">
          <State
            rows={rows}
            numStates={numStates}
            viewMode={viewMode}
            originalRows={originalRows}
            selection={selection}
            hoverIndex={hoverIndex}
            matrixSlots={matrixSlots}
          />
        </div>
      </div>
    </div>
  );
}
