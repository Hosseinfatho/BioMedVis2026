import { useEffect, useMemo, useState } from 'react';
import { MODELS, SYSTEMS } from '../../config/dataFiles';
import Viewer3D, { VIEWER_3D_TAB_LABEL } from './Viewer3D/Viewer3D';
import Computation3DPanel from './3DComputationPanel/3DComputationPanel';

export default function Analysis3D({
  systemsData = {},
  defaultSystemId,
  defaultModelId = 'states2',
  viewerTarget = null,
}) {
  const [activeViewerTarget, setActiveViewerTarget] = useState(null);
  const [residueHighlight, setResidueHighlight] = useState(null);
  const [markovState, setMarkovState] = useState(0);

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

  useEffect(() => {
    if (viewerTarget?.state != null && Number.isFinite(Number(viewerTarget.state))) {
      setMarkovState(Number(viewerTarget.state));
    }
  }, [viewerTarget?.state]);

  useEffect(() => {
    const numStates = MODELS[defaultModelId]?.numStates ?? 2;
    setMarkovState((prev) => (prev >= numStates ? 0 : prev));
  }, [defaultModelId]);

  const effectiveTarget = activeViewerTarget ?? viewerTarget;

  if (!systems.length) {
    return null;
  }

  return (
    <div className="analysis-3d-section">
      <Computation3DPanel
        defaultSystemId={defaultSystemId}
        defaultModelId={defaultModelId}
        systems={systems}
        markovState={markovState}
        onMarkovStateChange={setMarkovState}
        onViewerTargetChange={setActiveViewerTarget}
        onResidueHighlightChange={setResidueHighlight}
      />

      <section className="analysis-3d" aria-label={VIEWER_3D_TAB_LABEL}>
        <Viewer3D
          systems={systems}
          defaultSystemId={defaultSystemId}
          defaultModelId={defaultModelId}
          markovState={markovState}
          onMarkovStateChange={setMarkovState}
          viewerTarget={effectiveTarget}
          onViewerTargetChange={setActiveViewerTarget}
          residueHighlight={residueHighlight}
        />
      </section>
    </div>
  );
}
