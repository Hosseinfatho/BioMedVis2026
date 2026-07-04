import ComparisonRow from './ComparisonRow';

export default function Comparison({
  systemData,
  selectedModel,
  numStates,
  selection,
  hoverIndex,
}) {
  if (!systemData.length) return null;

  return (
    <div className="comparison">
      {systemData.map(({ systemId, rows, viewMode }) => (
        <ComparisonRow
          key={systemId}
          systemId={systemId}
          rows={rows}
          viewMode={viewMode}
          modelId={selectedModel}
          numStates={numStates}
          selection={selection}
          hoverIndex={hoverIndex}
        />
      ))}
    </div>
  );
}
