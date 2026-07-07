export default function TrajectorySelector({
  trajectoryRows,
  trajectoryName,
  onTrajectoryChange,
  frameIndex,
  onFrameChange,
  numStates,
}) {
  const selected =
    trajectoryRows.find((row) => row.name === trajectoryName) || trajectoryRows[0];
  const maxFrame = Math.max(0, (selected?.length ?? 1) - 1);
  const safeFrame = Math.min(frameIndex, maxFrame);
  const stateAtFrame = selected?.states?.[safeFrame];

  return (
    <div className="trajectory-selector">
      <label className="trajectory-selector-field">
        Trajectory
        <select
          value={trajectoryName}
          onChange={(e) => onTrajectoryChange(e.target.value)}
        >
          {trajectoryRows.map((row) => (
            <option key={row.name} value={row.name}>
              {row.name}
            </option>
          ))}
        </select>
      </label>

      <label className="trajectory-selector-field">
        Frame
        <div className="trajectory-selector-frame">
          <input
            type="range"
            min={0}
            max={maxFrame}
            value={safeFrame}
            onChange={(e) => onFrameChange(Number(e.target.value))}
          />
          <input
            type="number"
            min={0}
            max={maxFrame}
            value={safeFrame}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) {
                onFrameChange(Math.min(maxFrame, Math.max(0, next)));
              }
            }}
          />
          <span className="trajectory-selector-frame-total">/ {maxFrame}</span>
        </div>
      </label>

      {stateAtFrame != null && (
        <div className="trajectory-selector-state">
          Markov state at frame: <strong>{stateAtFrame}</strong>
          {numStates != null && (
            <span className="trajectory-selector-state-of">
              {' '}
              (of {numStates})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
