import { useMemo } from 'react';
import TrajectoryRows from '../TrajectoryRows';
import State from '../State';
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
  const searchRows = useMemo(() => {
    const source =
      viewMode === 'concatenated' && originalRows?.length ? originalRows : rows;
    if (!source?.length) return [];
    return [...source].sort(
      (a, b) =>
        (a.startTime ?? 0) - (b.startTime ?? 0) ||
        (a.orderIndex ?? 0) - (b.orderIndex ?? 0) ||
        String(a.name).localeCompare(String(b.name))
    );
  }, [rows, originalRows, viewMode]);

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
