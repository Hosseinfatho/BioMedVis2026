import { useEffect, useMemo, useState } from 'react';
import { SYSTEMS } from '../../config/dataFiles';
import Viewer3D, { RESIDUE_VIEWER_TITLE } from './Viewer3D/Viewer3D';
import Computation3DPanel from './3DComputationPanel/3DComputationPanel';

export default function Analysis3D({
  systemsData = {},
  defaultSystemId,
  defaultModelId = 'states2',
  viewerTarget = null,
}) {
  const [activeViewerTarget, setActiveViewerTarget] = useState(null);
  const [residueHighlight, setResidueHighlight] = useState(null);

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

  useEffect(() => {
    if (viewerTarget?.systemId && viewerTarget?.trajectoryName) {
      setActiveViewerTarget(viewerTarget);
      setResidueHighlight(null);
    }
  }, [viewerTarget]);

  const effectiveTarget = activeViewerTarget ?? viewerTarget;

  if (!systems.length) {
    return null;
  }

  return (
    <div className="analysis-3d-section">
      <section className="analysis-3d" aria-label={RESIDUE_VIEWER_TITLE}>
        <Viewer3D
          systems={systems}
          defaultSystemId={defaultSystemId}
          viewerTarget={effectiveTarget}
          residueHighlight={residueHighlight}
        />
      </section>

      <Computation3DPanel
        defaultSystemId={defaultSystemId}
        defaultModelId={defaultModelId}
        systems={systems}
        onViewerTargetChange={setActiveViewerTarget}
        onResidueHighlightChange={setResidueHighlight}
      />
    </div>
  );
}
