import ComparisonRow from './ComparisonRow';

export default function Comparison({
  systemData,
  selectedModel,
  numStates,
  selection,
  hoverIndex,
  matrixSlots,
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
        />
      ))}
    </div>
  );
}
