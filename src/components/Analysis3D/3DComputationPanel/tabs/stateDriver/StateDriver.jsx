import { useCallback, useEffect, useMemo, useState } from 'react';
import { MODELS } from '../../../../../config/dataFiles';
import { getMarkovStateColor } from '../../../../../utils/constants';
import { stateOptionsForModel, findRepresentativeFrame } from '../../../../../utils/conformationalDriversData';
import DifferentialArcInteractionDiagram from './DifferentialArcInteractionDiagram.jsx';
import LigandContactRows from './LigandContactRows.jsx';
import StateDriverArcLimit from './StateDriverArcLimit.jsx';
import {
  ALL_SYSTEMS,
  DEFAULT_ARC_LIMIT,
  TRAJECTORY_TYPE,
  filterArcEdgesForSystems,
  filterEdgesForResidue,
  sortSystems,
  systemLabel,
} from './stateDriverMetrics.js';
import { useDriverInteractionData } from './useDriverInteractionData.js';
import { useComputationToolbarPortal } from '../../../ComputationToolbarPortal';

/**
 * @typedef {Object} ViewerTarget
 * @property {string} systemId
 * @property {string} trajectoryName
 * @property {number} frameIndex
 */

/**
 * @typedef {Object} ResidueHighlight
 * @property {number} i
 * @property {number | null} j
 * @property {string} [ligand]
 */

/**
 * @typedef {Object} InteractionEdge
 * @property {string} pairKey
 * @property {number} source
 * @property {number} target
 * @property {string} winner
 */

/**
 * @typedef {Object} LigandContact
 * @property {number} residue
 * @property {string} ligand
 * @property {string} systemId
 */

/**
 * @typedef {Object} SystemInfo
 * @property {string} systemId
 * @property {Array<{ name: string }>} [trajectoryRows]
 */

/**
 * @typedef {Object} RepresentativeFrame
 * @property {string} systemId
 * @property {string} trajectoryName
 * @property {number} frameIndex
 */

/**
 * @property {number} [state]
 */

/**
 * @param {Object} props
 * @param {string} [props.defaultModelId]
 * @param {SystemInfo[]} [props.systems]
 * @param {number} [props.markovState]
 * @param {(state: number) => void} [props.onMarkovStateChange]
 * @param {(target: ViewerTarget) => void} [props.onViewerTargetChange]
 * @param {(highlight: ResidueHighlight | null) => void} [props.onResidueHighlightChange]
 */
export default function StateDriver({
  defaultModelId = 'states2',
  systems = [],
  markovState = 0,
  onMarkovStateChange,
  onViewerTargetChange,
  onResidueHighlightChange,
}) {
  const [modelId, setModelId] = useState(defaultModelId);
  const [activeSystems, setActiveSystems] = useState([...ALL_SYSTEMS]);
  const [selectedEdge, setSelectedEdge] = useState(/** @type {InteractionEdge | null} */ (null));
  const [selectedContact, setSelectedContact] = useState(/** @type {LigandContact | null} */ (null));
  const [selectedResidue, setSelectedResidue] = useState(/** @type {number | null} */ (null));
  const [arcLimit, setArcLimit] = useState(DEFAULT_ARC_LIMIT);

  const sortedActive = useMemo(() => sortSystems(activeSystems), [activeSystems]);
  const { loading, error, bundle, representativeRows } = useDriverInteractionData(
    modelId,
    markovState,
    sortedActive
  );
  const stateOptions = useMemo(() => stateOptionsForModel(modelId), [modelId]);
  const stateColor = getMarkovStateColor(markovState);

  const scopedEligibleEdges = useMemo(() => {
    if (!selectedResidue) return bundle.allEligibleEdges;
    return filterEdgesForResidue(bundle.allEligibleEdges, selectedResidue);
  }, [bundle.allEligibleEdges, selectedResidue]);

  const displayEligibleCount = scopedEligibleEdges.length;

  const displayEdges = useMemo(
    () => filterArcEdgesForSystems(scopedEligibleEdges, sortedActive, arcLimit),
    [scopedEligibleEdges, sortedActive, arcLimit]
  );

  const focusedResidue = selectedResidue ?? selectedContact?.residue ?? null;

  useEffect(() => {
    if (defaultModelId && defaultModelId in MODELS) {
      setModelId(defaultModelId);
    }
  }, [defaultModelId]);

  useEffect(() => {
    if (markovState >= stateOptions.length) {
      onMarkovStateChange?.(0);
    }
  }, [markovState, stateOptions.length, onMarkovStateChange]);

  const trajectoryNames = useMemo(() => {
    const names = new Map();
    for (const sys of systems) {
      names.set(sys.systemId, new Set((sys.trajectoryRows ?? []).map((row) => row.name)));
    }
    return names;
  }, [systems]);

  const applyViewer = useCallback(
    /**
     * @param {string} systemId
     * @param {RepresentativeFrame | null | undefined} representative
     */
    (systemId, representative) => {
      if (!representative) return;
      const allowed = trajectoryNames.get(systemId);
      if (!allowed?.has(representative.trajectoryName)) return;
      if (onViewerTargetChange) {
        onViewerTargetChange({
          systemId: representative.systemId,
          trajectoryName: representative.trajectoryName,
          frameIndex: representative.frameIndex,
          state: markovState,
        });
      }
    },
    [trajectoryNames, onViewerTargetChange, markovState]
  );

  const defaultSystemId = sortedActive[0] ?? ALL_SYSTEMS[0];

  const pushRepresentativeViewer = useCallback(
    (targetState, systemId = defaultSystemId) => {
      const representative = findRepresentativeFrame(
        representativeRows,
        systemId,
        modelId,
        TRAJECTORY_TYPE,
        targetState
      );
      if (!representative) return;
      const allowed = trajectoryNames.get(systemId);
      if (!allowed?.has(representative.trajectoryName)) return;
      onViewerTargetChange?.({
        systemId: representative.systemId,
        trajectoryName: representative.trajectoryName,
        frameIndex: representative.frameIndex,
        state: targetState,
      });
    },
    [
      representativeRows,
      defaultSystemId,
      modelId,
      trajectoryNames,
      onViewerTargetChange,
    ]
  );

  const handleStateSelect = useCallback(
    (nextState) => {
      const target = Number(nextState);
      if (!Number.isFinite(target)) return;
      onMarkovStateChange?.(target);
      setSelectedEdge(null);
      setSelectedContact(null);
      setSelectedResidue(null);
      if (onResidueHighlightChange) onResidueHighlightChange(null);
      pushRepresentativeViewer(target);
    },
    [onMarkovStateChange, onResidueHighlightChange, pushRepresentativeViewer]
  );

  useEffect(() => {
    setSelectedEdge(null);
    setSelectedContact(null);
    setSelectedResidue(null);
    if (onResidueHighlightChange) onResidueHighlightChange(null);
    pushRepresentativeViewer(markovState, defaultSystemId);
  }, [
    modelId,
    sortedActive,
    defaultSystemId,
    pushRepresentativeViewer,
    onResidueHighlightChange,
  ]);

  useEffect(() => {
    if (!selectedEdge) return;
    const stillVisible = displayEdges.some(
      (/** @type {InteractionEdge} */ edge) => edge.pairKey === selectedEdge.pairKey
    );
    if (!stillVisible) {
      setSelectedEdge(null);
      if (!selectedResidue && !selectedContact) {
        if (onResidueHighlightChange) onResidueHighlightChange(null);
      }
    }
  }, [
    displayEdges,
    selectedEdge,
    selectedResidue,
    selectedContact,
    onResidueHighlightChange,
  ]);

  useEffect(() => {
    if (displayEligibleCount > 0 && arcLimit > displayEligibleCount) {
      setArcLimit(displayEligibleCount);
    }
  }, [displayEligibleCount, arcLimit]);

  const toggleSystem = useCallback(/** @param {string} systemId */ (systemId) => {
    setActiveSystems((prev) => {
      const sorted = sortSystems(prev);
      if (sorted.includes(systemId)) {
        if (sorted.length === 1) return sorted;
        return sorted.filter((id) => id !== systemId);
      }
      return sortSystems([...sorted, systemId]);
    });
  }, []);

  const handleResidueSelect = useCallback(
    /** @param {number} residue */ (residue) => {
      const next = selectedResidue === residue ? null : residue;
      setSelectedResidue(next);
      setSelectedEdge(null);
      setSelectedContact(null);
      if (onResidueHighlightChange) {
        onResidueHighlightChange(next ? { i: next, j: null } : null);
      }
      if (next) {
        applyViewer(defaultSystemId, bundle.representatives[defaultSystemId]);
      }
    },
    [
      applyViewer,
      bundle.representatives,
      defaultSystemId,
      onResidueHighlightChange,
      selectedResidue,
    ]
  );

  const handleEdgeSelect = useCallback(
    /** @param {InteractionEdge} edge */ (edge) => {
      setSelectedEdge(edge);
      setSelectedContact(null);
      if (onResidueHighlightChange) {
        onResidueHighlightChange({ i: edge.source, j: edge.target });
      }

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
    /** @param {LigandContact} contact */ (contact) => {
      setSelectedContact(contact);
      setSelectedEdge(null);
      setSelectedResidue(null);
      if (onResidueHighlightChange) {
        onResidueHighlightChange({ i: contact.residue, j: null, ligand: contact.ligand });
      }
      applyViewer(contact.systemId, bundle.representatives[contact.systemId]);
    },
    [applyViewer, bundle.representatives, onResidueHighlightChange]
  );

  const totalFrames =
    loading || error
      ? 0
      : sortedActive.reduce((sum, id) => sum + (bundle.frameCounts[id] ?? 0), 0);

  const toolbar =
    loading || error ? null : (
    <div className="state-driver-toolbar">
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
          className="viewer-3d-select viewer-3d-select--model"
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
          value={markovState}
          onChange={(e) => handleStateSelect(Number(e.target.value))}
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
          aria-label={`State S${markovState}`}
        >
          S{markovState}
        </div>

        {totalFrames > 0 ? (
          <StateDriverArcLimit
            value={arcLimit}
            max={displayEligibleCount}
            total={displayEligibleCount}
            onChange={setArcLimit}
          />
        ) : null}
      </div>
    </div>
  );
  const toolbarPortal = useComputationToolbarPortal(toolbar);

  if (loading) {
    return <div className="state-driver-status">Loading StateDriver interaction data…</div>;
  }

  if (error) {
    return <div className="state-driver-error">{error}</div>;
  }

  return (
    <div className="computation-tab computation-tab--state-driver">
      {toolbarPortal}

      {totalFrames === 0 ? (
        <p className="state-driver-muted">
          No interaction data for this model/state in the selected system(s).
        </p>
      ) : (
        <div className="state-driver-viz">
          <DifferentialArcInteractionDiagram
            edges={displayEdges}
            nodeProximity={bundle.nodeProximity}
            selectedEdgeKey={selectedEdge?.pairKey ?? null}
            selectedResidue={selectedResidue}
            highlightedResidue={focusedResidue}
            onEdgeSelect={handleEdgeSelect}
            onResidueSelect={handleResidueSelect}
          />
          <LigandContactRows
            ligandRows={bundle.ligandRows}
            selectedContact={selectedContact}
            onContactSelect={handleContactSelect}
          />
        </div>
      )}
    </div>
  );
}
