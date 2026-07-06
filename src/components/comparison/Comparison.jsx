import ComparisonRow from './ComparisonRow';
import DualComparisonRow from './DualComparisonRow';

export default function Comparison({
  systemData,
  selectedModel,
  numStates,
  selection,
  hoverIndex,
  matrixSlots,
  activeMotif,
  hoveredMotif,
  onMotifHoverChange,
  chartTimeOffsetB = 0,
  onChartTimeOffsetBChange,
}) {
  if (!systemData.length) return null;

  if (systemData.length === 2) {
    const [a, b] = systemData;
    return (
      <div className="comparison">
        <DualComparisonRow
          systemA={a.systemId}
          systemB={b.systemId}
          rowsA={a.rows}
          rowsB={b.rows}
          modelId={selectedModel}
          numStates={numStates}
          viewMode={a.viewMode}
          timeOffsetB={chartTimeOffsetB}
          onTimeOffsetBChange={onChartTimeOffsetBChange}
          selection={selection}
          hoverIndex={hoverIndex}
        />
      </div>
    );
  }

  return (
    <div className="comparison">
      {systemData.map(({ systemId, rows, viewMode, originalRows }) => (
        <ComparisonRow
          key={systemId}
          systemId={systemId}
          rows={rows}
          viewMode={viewMode}
          originalRows={originalRows}
          modelId={selectedModel}
          numStates={numStates}
          selection={selection}
          hoverIndex={hoverIndex}
          matrixSlots={matrixSlots}
          activeMotif={activeMotif}
          hoveredMotif={hoveredMotif}
          onMotifHoverChange={onMotifHoverChange}
        />
      ))}
    </div>
  );
}
