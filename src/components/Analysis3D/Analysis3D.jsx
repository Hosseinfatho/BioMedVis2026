import { useMemo } from 'react';
import { SYSTEMS } from '../../config/dataFiles';
import Viewer3D, { RESIDUE_VIEWER_TITLE } from './Viewer3D/Viewer3D';

export default function Analysis3D({
  systemsData = {},
  defaultSystemId,
  viewerTarget = null,
}) {
  const systems = useMemo(
    () =>
      Object.entries(systemsData)
        .filter(([, rows]) => rows?.length)
        .map(([systemId, trajectoryRows]) => ({
          systemId,
          label: SYSTEMS[systemId]?.label ?? systemId,
          trajectoryRows,
        })),
    [systemsData]
  );

  if (!systems.length) {
    return null;
  }

  return (
    <div className="analysis-3d-section">
      <section className="analysis-3d" aria-label={RESIDUE_VIEWER_TITLE}>
        <Viewer3D
          systems={systems}
          defaultSystemId={defaultSystemId}
          viewerTarget={viewerTarget}
        />
      </section>
    </div>
  );
}
