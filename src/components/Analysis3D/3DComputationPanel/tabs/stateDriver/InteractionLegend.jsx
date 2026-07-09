export default function InteractionLegend() {
  return (
    <div className="state-driver-legend" aria-label="Interaction legend">
      <div className="state-driver-legend-encodings">
        <span>Arc width → frequency</span>
        <span>Arc opacity → persistence</span>
        <span>Arc length → proximity</span>
      </div>
    </div>
  );
}
