import { useEffect, useMemo, useState } from 'react';
import MoleculeViewer3D from './MoleculeViewer3D';
import TrajectorySelector from './TrajectorySelector';
import { DEFAULT_FRAME, DEFAULT_TRAJECTORY } from './trajectoryConfig';
import Task01Contacts from './Task01Contacts';
import Task02StructuredRegions from './Task02StructuredRegions';
import Task03Rmsf from './Task03Rmsf';
import Task04StateDistances from './Task04StateDistances';
import Task05TerminiBehavior from './Task05TerminiBehavior';
import Task06DistanceDistributions from './Task06DistanceDistributions';
import Task07TransitionDrivers from './Task07TransitionDrivers';
import Task08SystemComparison from './Task08SystemComparison';
import Task09LocalGlobalMotion from './Task09LocalGlobalMotion';
import Task10BrushLink from './Task10BrushLink';

function initialTrajectory(rows) {
  if (!rows?.length) return DEFAULT_TRAJECTORY;
  const preferred = rows.find((row) => row.name === DEFAULT_TRAJECTORY);
  return preferred?.name ?? rows[0].name;
}

export default function Simulation3DPanel({
  systemId,
  numStates,
  trajectoryRows = [],
  selection = null,
}) {
  const [trajectoryName, setTrajectoryName] = useState(() =>
    initialTrajectory(trajectoryRows)
  );
  const [frameIndex, setFrameIndex] = useState(DEFAULT_FRAME);

  const sortedRows = useMemo(
    () =>
      [...trajectoryRows].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
    [trajectoryRows]
  );

  useEffect(() => {
    if (!sortedRows.length) return;
    const exists = sortedRows.some((row) => row.name === trajectoryName);
    if (!exists) {
      setTrajectoryName(initialTrajectory(sortedRows));
      setFrameIndex(0);
    }
  }, [sortedRows, trajectoryName]);

  useEffect(() => {
    const row = sortedRows.find((r) => r.name === trajectoryName);
    if (!row) return;
    const maxFrame = Math.max(0, row.length - 1);
    if (frameIndex > maxFrame) setFrameIndex(maxFrame);
  }, [sortedRows, trajectoryName, frameIndex]);

  const shared = { systemId, trajectoryName, frameIndex };

  if (!sortedRows.length) {
    return null;
  }

  return (
    <section className="simulation-3d-panel">
      <div className="simulation-3d-panel-header">
        <h3 className="simulation-3d-panel-title">3D residue analysis</h3>
        <span className="simulation-3d-panel-subtitle">
          Interactive structure (left) · expert residue charts (right)
        </span>
      </div>

      <div className="simulation-3d-layout">
        <div className="simulation-3d-viewer-col">
          <TrajectorySelector
            trajectoryRows={sortedRows}
            trajectoryName={trajectoryName}
            onTrajectoryChange={(name) => {
              setTrajectoryName(name);
              setFrameIndex(0);
            }}
            frameIndex={frameIndex}
            onFrameChange={setFrameIndex}
            numStates={numStates}
          />
          <MoleculeViewer3D {...shared} />
        </div>

        <div className="simulation-3d-charts-col">
          <Task01Contacts {...shared} />
          <Task02StructuredRegions trajectoryName={trajectoryName} />
          <Task03Rmsf trajectoryName={trajectoryName} />
          <Task04StateDistances trajectoryName={trajectoryName} numStates={numStates} />
          <Task05TerminiBehavior systemId={systemId} />
          <Task06DistanceDistributions
            trajectoryName={trajectoryName}
            numStates={numStates}
          />
          <Task07TransitionDrivers trajectoryName={trajectoryName} />
          <Task08SystemComparison systemId={systemId} />
          <Task09LocalGlobalMotion trajectoryName={trajectoryName} />
          <Task10BrushLink selection={selection} trajectoryName={trajectoryName} />
        </div>
      </div>
    </section>
  );
}
