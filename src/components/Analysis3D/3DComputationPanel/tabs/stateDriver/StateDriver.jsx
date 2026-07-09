import { useCallback, useEffect, useMemo, useState } from 'react';
import { MODELS } from '../../../../../config/dataFiles';
import { getMarkovStateColor } from '../../../../../utils/constants';
import { stateOptionsForModel } from '../../../../../utils/conformationalDriversData';
import DifferentialArcInteractionDiagram from './DifferentialArcInteractionDiagram';
import InteractionLegend from './InteractionLegend';
import LigandContactRows from './LigandContactRows';
import {
  ALL_SYSTEMS,
  sortSystems,
  systemLabel,
} from './stateDriverMetrics';
import { useStateDriverData } from './useStateDriverData';

export default function StateDriver({
  defaultModelId = 'states2',
  systems = [],
  onViewerTargetChange,
  onResidueHighlightChange,
}) {
  const [modelId, setModelId] = useState(defaultModelId);
  const [state, setState] = useState(0);
  const [activeSystems, setActiveSystems] = useState([...ALL_SYSTEMS]);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

  const sortedActive = useMemo(() => sortSystems(activeSystems), [activeSystems]);
  const { loading, error, bundle } = useStateDriverData(modelId, state, sortedActive);
  const stateOptions = useMemo(() => stateOptionsForModel(modelId), [modelId]);
  const stateColor = getMarkovStateColor(state);

  useEffect(() => {
    if (defaultModelId && MODELS[defaultModelId]) {
      setModelId(defaultModelId);
    }
  }, [defaultModelId]);

  useEffect(() => {
    if (state >= stateOptions.length) {
      setState(0);
    }
  }, [state, stateOptions.length]);

  const trajectoryNames = useMemo(() => {
    const names = new Map();
    for (const sys of systems) {
      names.set(sys.systemId, new Set((sys.trajectoryRows ?? []).map((row) => row.name)));
    }
    return names;
  }, [systems]);

  const applyViewer = useCallback(
    (systemId, representative) => {
      if (!representative) return;
      const allowed = trajectoryNames.get(systemId);
      if (!allowed?.has(representative.trajectoryName)) return;
      onViewerTargetChange?.({
        systemId: representative.systemId,
        trajectoryName: representative.trajectoryName,
        frameIndex: representative.frameIndex,
      });
    },
    [trajectoryNames, onViewerTargetChange]
  );

  const defaultSystemId = sortedActive[0] ?? ALL_SYSTEMS[0];

  useEffect(() => {
    setSelectedEdge(null);
    setSelectedContact(null);
    onResidueHighlightChange?.(null);
    applyViewer(defaultSystemId, bundle.representatives[defaultSystemId]);
  }, [
    modelId,
    state,
    sortedActive,
    defaultSystemId,
    bundle.representatives,
    applyViewer,
    onResidueHighlightChange,
  ]);

  const toggleSystem = useCallback((systemId) => {
    setActiveSystems((prev) => {
      const sorted = sortSystems(prev);
      if (sorted.includes(systemId)) {
        if (sorted.length === 1) return sorted;
        return sorted.filter((id) => id !== systemId);
      }
      return sortSystems([...sorted, systemId]);
    });
  }, []);

  const arcLabels = useMemo(() => {
    if (sortedActive.length === 1) {
      return { top: `${systemLabel(sortedActive[0])} interactions`, bottom: '' };
    }
    if (sortedActive.length === 2) {
      return {
        top: `${systemLabel(sortedActive[0])} stronger`,
        bottom: `${systemLabel(sortedActive[1])} stronger`,
      };
    }
    return {
      top: 'Stronger (Free Aβ42 / TMP)',
      bottom: 'Stronger (SPA)',
    };
  }, [sortedActive]);

  const handleEdgeSelect = useCallback(
    (edge) => {
      setSelectedEdge(edge);
      setSelectedContact(null);
      onResidueHighlightChange?.({ i: edge.source, j: edge.target });

      const viewerSystem =
        edge.winner !== 'shared' && sortedActive.includes(edge.winner)
          ? edge.winner
          : defaultSystemId;
      applyViewer(viewerSystem, bundle.representatives[viewerSystem]);
    },
    [
      applyViewer,
      bundle.representatives,
      defaultSystemId,
      onResidueHighlightChange,
      sortedActive,
    ]
  );

  const handleContactSelect = useCallback(
    (contact) => {
      setSelectedContact(contact);
      setSelectedEdge(null);
      onResidueHighlightChange?.({ i: contact.residue, j: null, ligand: contact.ligand });
      applyViewer(contact.systemId, bundle.representatives[contact.systemId]);
    },
    [applyViewer, bundle.representatives, onResidueHighlightChange]
  );

  if (loading) {
    return <div className="state-driver-status">Loading StateDriver interaction data…</div>;
  }

  if (error) {
    return <div className="state-driver-error">{error}</div>;
  }

  const totalFrames = sortedActive.reduce(
    (sum, id) => sum + (bundle.frameCounts[id] ?? 0),
    0
  );

  return (
    <div className="computation-tab computation-tab--state-driver">
      <div className="state-driver-toolbar">
        <div className="state-driver-toolbar-main">
          <h4 className="computation-tab-title">StateDriver</h4>
          <p className="state-driver-subtitle">
            {sortedActive.map(systemLabel).join(' · ')} · heavy-atom soft contacts
          </p>
        </div>
        <div className="viewer-3d-controls">
          <div className="state-driver-system-checks" role="group" aria-label="Systems to display">
            {ALL_SYSTEMS.map((systemId) => {
              const checked = sortedActive.includes(systemId);
              const disabled = checked && sortedActive.length === 1;
              return (
                <label key={systemId} className="state-driver-system-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleSystem(systemId)}
                  />
                  <span
                    className="state-driver-system-check-swatch"
                    data-system={systemId}
                  />
                  {systemLabel(systemId)}
                </label>
              );
            })}
          </div>

          <select
            className="viewer-3d-select"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            aria-label="Model"
          >
            {Object.entries(MODELS).map(([id, meta]) => (
              <option key={id} value={id}>
                {meta.label}
              </option>
            ))}
          </select>

          <select
            className="viewer-3d-select viewer-3d-select--frame"
            value={state}
            onChange={(e) => setState(Number(e.target.value))}
            aria-label="State"
          >
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                State {s}
              </option>
            ))}
          </select>

          <div
            className="viewer-3d-state-badge"
            style={{ color: stateColor, borderColor: stateColor }}
            aria-label={`State S${state}`}
          >
            S{state}
          </div>
        </div>
      </div>

      {totalFrames === 0 ? (
        <p className="state-driver-muted">
          No interaction data for this model/state in the selected system(s).
        </p>
      ) : (
        <>
          <div className="state-driver-viz">
            <DifferentialArcInteractionDiagram
              edges={bundle.residueResidueEdges}
              nodeProximity={bundle.nodeProximity}
              activeSystems={bundle.activeSystems}
              selectedEdgeKey={selectedEdge?.pairKey ?? null}
              topLabel={arcLabels.top}
              bottomLabel={arcLabels.bottom}
              onEdgeSelect={handleEdgeSelect}
            />
            <LigandContactRows
              ligandRows={bundle.ligandRows}
              selectedContact={selectedContact}
              onContactSelect={handleContactSelect}
            />
          </div>

          <InteractionLegend activeSystems={bundle.activeSystems} />

          <div className="state-driver-meta">
            {sortedActive.map((systemId) => (
              <span key={systemId}>
                {systemLabel(systemId)} frames:{' '}
                {(bundle.frameCounts[systemId] ?? 0).toLocaleString()}
              </span>
            ))}
            <span>Arcs shown: {bundle.residueResidueEdges.length}</span>
            {selectedEdge ? (
              <span>
                Selected R{selectedEdge.source}–R{selectedEdge.target}
                {bundle.compareMode
                  ? sortedActive
                      .map(
                        (id) =>
                          ` ${systemLabel(id)} ${(selectedEdge.strengths[id] ?? 0).toFixed(2)}`
                      )
                      .join(',')
                  : `: ${selectedEdge.displayStrength.toFixed(2)}`}
              </span>
            ) : null}
            {selectedContact ? (
              <span>
                Selected R{selectedContact.residue} · {selectedContact.ligand}: strength{' '}
                {selectedContact.strength.toFixed(2)}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
