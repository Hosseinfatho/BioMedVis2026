import { useCallback, useEffect, useMemo, useState } from 'react';
import { MODELS, SYSTEMS } from '../../../../../config/dataFiles';
import { getMarkovStateColor } from '../../../../../utils/constants';
import {
  buildResidualContactMatrix,
  filterRmsdDistribution,
  filterStateSummary,
  findRepresentativeFrame,
  loadContactMaps,
  loadRepresentativeFrameRows,
  loadRmsdByStateRows,
  loadStateSummaryRows,
  stateOptionsForModel,
} from '../../../../../utils/conformationalDriversData';
import ConformationalDriverMatrix from './ConformationalDriverMatrix';
import RMSDStateSummary from './RMSDStateSummary';
import TopResidualPairs from './TopResidualPairs';

const SYSTEM_IDS = Object.keys(SYSTEMS);
const TRAJECTORY_TYPE = 'original';

export default function StateDriver({
  defaultSystemId,
  defaultModelId = 'states2',
  systems = [],
  onViewerTargetChange,
  onResidueHighlightChange,
}) {
  const [systemId, setSystemId] = useState(
    () => defaultSystemId || SYSTEM_IDS[0]
  );
  const [modelId, setModelId] = useState(defaultModelId);
  const [state, setState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactMaps, setContactMaps] = useState(null);
  const [stateSummaryRows, setStateSummaryRows] = useState([]);
  const [rmsdRows, setRmsdRows] = useState([]);
  const [representativeRows, setRepresentativeRows] = useState([]);
  const [selectedPair, setSelectedPair] = useState(null);

  useEffect(() => {
    if (defaultSystemId && SYSTEM_IDS.includes(defaultSystemId)) {
      setSystemId(defaultSystemId);
    }
  }, [defaultSystemId]);

  useEffect(() => {
    if (defaultModelId && MODELS[defaultModelId]) {
      setModelId(defaultModelId);
    }
  }, [defaultModelId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      loadContactMaps(),
      loadStateSummaryRows(),
      loadRmsdByStateRows(),
      loadRepresentativeFrameRows(),
    ])
      .then(([maps, summaries, rmsd, reps]) => {
        if (cancelled) return;
        setContactMaps(maps);
        setStateSummaryRows(summaries);
        setRmsdRows(rmsd);
        setRepresentativeRows(reps);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stateOptions = useMemo(() => stateOptionsForModel(modelId), [modelId]);
  const stateColor = getMarkovStateColor(state);

  useEffect(() => {
    if (state >= stateOptions.length) {
      setState(0);
    }
  }, [state, stateOptions.length]);

  const matrixBundle = useMemo(() => {
    if (!contactMaps) {
      return { matrix: null, topPairs: [], maxAbs: 1, frameCount: 0 };
    }
    return buildResidualContactMatrix(
      contactMaps,
      systemId,
      modelId,
      TRAJECTORY_TYPE,
      state
    );
  }, [contactMaps, systemId, modelId, state]);

  const summary = useMemo(
    () =>
      filterStateSummary(
        stateSummaryRows,
        systemId,
        modelId,
        TRAJECTORY_TYPE,
        state
      ),
    [stateSummaryRows, systemId, modelId, state]
  );

  const rmsdBins = useMemo(
    () =>
      filterRmsdDistribution(
        rmsdRows,
        systemId,
        modelId,
        TRAJECTORY_TYPE,
        state
      ),
    [rmsdRows, systemId, modelId, state]
  );

  const representative = useMemo(
    () =>
      findRepresentativeFrame(
        representativeRows,
        systemId,
        modelId,
        TRAJECTORY_TYPE,
        state
      ),
    [representativeRows, systemId, modelId, state]
  );

  const trajectoryNames = useMemo(() => {
    const match = systems.find((s) => s.systemId === systemId);
    return new Set((match?.trajectoryRows ?? []).map((row) => row.name));
  }, [systems, systemId]);

  const applyViewerForState = useCallback(() => {
    if (!representative || !trajectoryNames.has(representative.trajectoryName))
      return;

    onViewerTargetChange?.({
      systemId: representative.systemId,
      trajectoryName: representative.trajectoryName,
      frameIndex: representative.frameIndex,
    });
  }, [representative, trajectoryNames, onViewerTargetChange]);

  useEffect(() => {
    setSelectedPair(null);
    onResidueHighlightChange?.(null);
    applyViewerForState();
  }, [systemId, modelId, state, applyViewerForState, onResidueHighlightChange]);

  const handlePairSelect = useCallback(
    (pair) => {
      setSelectedPair(pair);
      onResidueHighlightChange?.({ i: pair.i, j: pair.j });
      applyViewerForState();
    },
    [applyViewerForState, onResidueHighlightChange]
  );

  if (loading) {
    return <div className="conf-driver-status">Loading conformational driver data…</div>;
  }

  if (error) {
    return <div className="conf-driver-error">{error}</div>;
  }

  return (
    <div className="computation-tab computation-tab--conformational-drivers">
      <div className="conf-driver-toolbar">
        <h4 className="computation-tab-title">StateDriver</h4>
        <div className="viewer-3d-controls">
          <select
            className="viewer-3d-select"
            value={systemId}
            onChange={(e) => setSystemId(e.target.value)}
            aria-label="System"
          >
            {SYSTEM_IDS.map((id) => (
              <option key={id} value={id}>
                {SYSTEMS[id].label}
              </option>
            ))}
          </select>

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

      <div className="conf-driver-matrix-row">
        <div className="conf-driver-main">
          <ConformationalDriverMatrix
            matrix={matrixBundle.matrix}
            maxAbs={matrixBundle.maxAbs}
            selectedPair={selectedPair}
            onCellSelect={handlePairSelect}
          />
        </div>

        <TopResidualPairs pairs={matrixBundle.topPairs} onPairClick={handlePairSelect} />
      </div>

      <RMSDStateSummary
        summary={summary}
        rmsdBins={rmsdBins}
        frameCount={matrixBundle.frameCount}
      />
    </div>
  );
}

