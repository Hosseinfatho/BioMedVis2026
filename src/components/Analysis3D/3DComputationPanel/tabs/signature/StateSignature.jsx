import { useCallback, useEffect, useMemo, useState } from 'react';
import { MODELS, SYSTEMS } from '../../../../../config/dataFiles';
import { getMarkovStateColor } from '../../../../../utils/constants';
import {
  findRepresentativeFrame,
} from '../../../../../utils/conformationalDriversData';
import {
  buildSignatureResidualMatrix,
  buildTrajectoryStateHistogram,
  filterRepresentativesForState,
  loadSignatureSources,
  STATE_SIGNATURE_DEFAULT_DISPLACEMENT_PERCENT,
  stateOptionsForModel,
} from '../../../../../utils/signatureData';
import { loadSystemData } from '../../../../../utils/loadSystemData';
import StateSignatureResidualMatrix from './StateSignatureResidualMatrix';
import StateSignatureTopPairs from './StateSignatureTopPairs';
import TrajectoryFrameHistogram from './TrajectoryFrameHistogram';

const SYSTEM_IDS = Object.keys(SYSTEMS);
const TRAJECTORY_TYPE = 'original';
const INNER_TABS = [
  { id: 'residues', label: 'Residues' },
  { id: 'frames', label: 'Frames' },
];

export default function StateSignature({
  defaultSystemId,
  defaultModelId = 'states2',
  systems = [],
  onViewerTargetChange,
  onResidueHighlightChange,
}) {
  const [systemId, setSystemId] = useState(() => defaultSystemId || SYSTEM_IDS[0]);
  const [modelId, setModelId] = useState(defaultModelId);
  const [state, setState] = useState(0);
  const [innerTab, setInnerTab] = useState('residues');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signatureResiduals, setSignatureResiduals] = useState(null);
  const [representativeRows, setRepresentativeRows] = useState([]);
  const [frameCountsByGroup, setFrameCountsByGroup] = useState({});
  const [selectedPair, setSelectedPair] = useState(null);
  const [selectedBar, setSelectedBar] = useState(null);
  const [displacementPercent, setDisplacementPercent] = useState(
    STATE_SIGNATURE_DEFAULT_DISPLACEMENT_PERCENT
  );
  const [trajectoryRows, setTrajectoryRows] = useState([]);
  const [trajectoryRowsLoading, setTrajectoryRowsLoading] = useState(false);

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
    loadSignatureSources()
      .then(({ signatureResiduals: residuals, representatives, frameCountsByGroup: counts }) => {
        if (cancelled) return;
        setSignatureResiduals(residuals);
        setRepresentativeRows(representatives);
        setFrameCountsByGroup(counts ?? {});
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
    if (state >= stateOptions.length) setState(0);
  }, [state, stateOptions.length]);

  useEffect(() => {
    let cancelled = false;
    setTrajectoryRowsLoading(true);
    loadSystemData(systemId, modelId, TRAJECTORY_TYPE)
      .then((rows) => {
        if (!cancelled) setTrajectoryRows(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setTrajectoryRows([]);
      })
      .finally(() => {
        if (!cancelled) setTrajectoryRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [systemId, modelId]);

  const trajectoryRowsForViewer = useMemo(() => {
    const match = systems.find((s) => s.systemId === systemId);
    return match?.trajectoryRows ?? trajectoryRows;
  }, [systems, systemId, trajectoryRows]);

  const signatureBundle = useMemo(() => {
    if (!signatureResiduals) {
      return {
        matrix: null,
        topPairs: [],
        maxValue: 1,
        minValue: 0,
        frameCount: 0,
        hasData: false,
      };
    }
    return buildSignatureResidualMatrix(
      signatureResiduals,
      systemId,
      modelId,
      TRAJECTORY_TYPE,
      state,
      displacementPercent
    );
  }, [signatureResiduals, systemId, modelId, state, displacementPercent]);

  const representatives = useMemo(
    () =>
      filterRepresentativesForState(
        representativeRows,
        systemId,
        modelId,
        TRAJECTORY_TYPE,
        state
      ),
    [representativeRows, systemId, modelId, state]
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

  const histogram = useMemo(
    () =>
      buildTrajectoryStateHistogram({
        trajectoryRows,
        representatives,
        selectedState: state,
        systemId,
        modelId,
        trajectoryType: TRAJECTORY_TYPE,
        frameCountsByGroup,
      }),
    [trajectoryRows, representatives, state, systemId, modelId, frameCountsByGroup]
  );

  const applyRepresentativeViewer = useCallback(() => {
    if (!representative) return;
    const names = new Set(trajectoryRowsForViewer.map((r) => r.name));
    if (!names.has(representative.trajectoryName)) return;
    onViewerTargetChange?.({
      systemId: representative.systemId,
      trajectoryName: representative.trajectoryName,
      frameIndex: representative.frameIndex,
    });
  }, [representative, trajectoryRowsForViewer, onViewerTargetChange]);

  useEffect(() => {
    setSelectedPair(null);
    setSelectedBar(null);
    onResidueHighlightChange?.(null);
    applyRepresentativeViewer();
  }, [systemId, modelId, state, applyRepresentativeViewer, onResidueHighlightChange]);

  const handlePairSelect = useCallback(
    (pair) => {
      setSelectedPair(pair);
      onResidueHighlightChange?.({ i: pair.i, j: pair.j });
      applyRepresentativeViewer();
    },
    [applyRepresentativeViewer, onResidueHighlightChange]
  );

  const handleBarSelect = useCallback(
    (bar) => {
      setSelectedBar(bar);
      onResidueHighlightChange?.(null);
      onViewerTargetChange?.({
        systemId,
        trajectoryName: bar.trajectoryName,
        frameIndex: bar.frameIndex,
      });
    },
    [onResidueHighlightChange, onViewerTargetChange, systemId]
  );

  if (loading) {
    return <div className="conf-driver-status">Loading state signature data…</div>;
  }
  if (error) {
    return <div className="conf-driver-error">{error}</div>;
  }

  return (
    <div className="computation-tab computation-tab--state-signature">
      <div className="conf-driver-toolbar">
        <h4 className="computation-tab-title">StateSignature</h4>
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

      <div className="state-sig-inner-tabs" role="tablist" aria-label="StateSignature views">
        {INNER_TABS.map((tab) => {
          const selected = tab.id === innerTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`state-sig-inner-tab${selected ? ' is-active' : ''}`}
              onClick={() => setInnerTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {innerTab === 'residues' && (
        <>
          <div className="state-sig-threshold-row">
            <label className="state-sig-threshold-label" htmlFor="state-sig-displacement">
              Max displacement (%)
            </label>
            <input
              id="state-sig-displacement"
              className="viewer-3d-select state-sig-threshold-input"
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={displacementPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value);
                if (Number.isFinite(next) && next > 0) setDisplacementPercent(next);
              }}
            />
          </div>
          <div className="conf-driver-matrix-row">
            <div className="conf-driver-main">
              <StateSignatureResidualMatrix
                matrix={signatureBundle.matrix}
                maxValue={signatureBundle.maxValue}
                minValue={signatureBundle.minValue}
                hasData={signatureBundle.hasData}
                selectedPair={selectedPair}
                onCellSelect={handlePairSelect}
              />
            </div>
            <StateSignatureTopPairs
              pairs={signatureBundle.topPairs}
              onPairClick={handlePairSelect}
            />
          </div>
        </>
      )}

      {innerTab === 'frames' && (
        <div className="state-sig-frames-panel">
          {trajectoryRowsLoading ? (
            <p className="conf-driver-muted">Loading trajectory state labels…</p>
          ) : (
            <TrajectoryFrameHistogram
              histogram={histogram}
              selectedBar={selectedBar}
              onBarSelect={handleBarSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}
