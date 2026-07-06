import { useMemo } from 'react';
import TrajectoryRows from '../TrajectoryRows';
import State from '../State';
import ComparisonHeader from './ComparisonHeader';
import { findGlobalMotifOccurrences } from '../../utils/motifs';

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
  activeMotif,
}) {
  const searchRows =
    viewMode === 'concatenated' && originalRows?.length ? originalRows : rows;

  const globalOccurrences = useMemo(() => {
    if (!activeMotif || !searchRows?.length) return [];
    return findGlobalMotifOccurrences(
      activeMotif,
      searchRows,
      matrixSlots,
      (row) => row.states || []
    );
  }, [activeMotif, searchRows, matrixSlots]);

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
            globalOccurrences={globalOccurrences}
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
            globalOccurrences={globalOccurrences}
          />
        </div>
      </div>
    </div>
  );
}
