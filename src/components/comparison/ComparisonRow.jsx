import { useMemo } from 'react';
import TrajectoryRows from '../TrajectoryRows';
import State from '../State';
import ComparisonHeader from './ComparisonHeader';
import { alignedMotifOccurrencesForSystem } from '../../utils/motifs';

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
  hoveredMotif,
  onMotifHoverChange,
  showXAxis = false,
}) {
  const searchRows =
    viewMode === 'concatenated' && originalRows?.length ? originalRows : rows;

  const globalOccurrences = useMemo(() => {
    if (!activeMotif || !searchRows?.length) return [];
    return alignedMotifOccurrencesForSystem(
      activeMotif,
      searchRows,
      matrixSlots,
      (row) => row.states || []
    );
  }, [activeMotif, searchRows, matrixSlots]);

  const hoveredMotifOccIdx =
    hoveredMotif?.systemId === systemId ? hoveredMotif.occurrenceIndex : null;

  return (
    <div className="comparison-row">
      <ComparisonHeader
        systemId={systemId}
        rowCount={rows.length}
        viewMode={viewMode}
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
            systemId={systemId}
            hoveredMotifOccIdx={hoveredMotifOccIdx}
            onMotifHoverChange={onMotifHoverChange}
            showXAxis={false}
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
            systemId={systemId}
            hoveredMotifOccIdx={hoveredMotifOccIdx}
            onMotifHoverChange={onMotifHoverChange}
            showXAxis={showXAxis}
          />
        </div>
      </div>
    </div>
  );
}
