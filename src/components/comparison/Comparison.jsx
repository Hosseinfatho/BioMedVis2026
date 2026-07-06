import ComparisonRow from './ComparisonRow';

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
}) {
  if (!systemData.length) return null;

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
