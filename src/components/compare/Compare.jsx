import { useState, useEffect, useMemo, useCallback } from 'react';
import { SYSTEMS } from '../../config/dataFiles';
import { loadSystemData } from '../../utils/loadSystemData';
import {
  fullView,
  panView,
  zoomView,
} from '../../utils/matrixViewport';
import {
  computeTrajectoryFeatures,
  getMatrixStates,
} from '../../utils/computeTransitionFeatures';
import {
  ALIGNMENT_NONE,
  buildAlignmentOptions,
} from '../../utils/alignment';
import { motifBundlesForSystem } from '../../utils/motifs';
import { slotKey } from '../../utils/slotKey';
import { buildMatrixSlotsFromRows, unionSystemIds } from '../../utils/matrixSlots';
import { trajectoriesByMatrixSlot } from '../../utils/matrixRepresentativeRows';
import InteractiveMatrix from './InteractiveMatrix';
import MotifPanel from './MotifPanel';
import Trace from '../Trace';
import Analysis3D from '../Analysis3D/Analysis3D';

const SYSTEM_IDS = Object.keys(SYSTEMS);

function sortSystemIds(systemIds) {
  return [...systemIds].sort((a, b) => SYSTEM_IDS.indexOf(a) - SYSTEM_IDS.indexOf(b));
}

function featuresBySlot(rows, numStates, alignmentId) {
  const map = new Map();
  rows.forEach((row) => {
    const key = slotKey(row.name);
    const prev = map.get(key);
    if (!prev || row.startTime > prev.startTime) {
      const states = getMatrixStates(row, 'original', alignmentId);
      map.set(key, {
        startTime: row.startTime,
        features: computeTrajectoryFeatures(states, numStates),
        states,
      });
    }
  });
  const out = new Map();
  for (const [key, { features, states }] of map) {
    out.set(key, { ...features, states });
  }
  return out;
}

const EMPTY = {
  stateRatios: [],
  transitionRatios: {},
  stateCounts: [],
  transitionCounts: {},
  total: 0,
  totalTransitions: 0,
};

function columnFromFeatures(features) {
  return {
    stateVals: features.stateRatios,
    transitionVals: features.transitionRatios,
    stateCounts: features.stateCounts,
    transitionCounts: features.transitionCounts,
    totalFrames: features.total,
    totalTransitions: features.totalTransitions,
    states: features.states,
  };
}

export default function Compare({
  selectedModel,
  numStates,
  defaultA,
  defaultB,
  comparisonSystemIds = [],
  sharedMatrixSlots = [],
  selection,
  onSelectionChange,
  hoverIndex,
  onHoverChange,
  onSlotsChange,
  activeMotif,
  onActiveMotifChange,
  hoveredMotif,
  onMotifHoverChange,
}) {
  const initialDraft = useMemo(() => {
    const ids = new Set(SYSTEM_IDS);
    if (defaultA) ids.add(defaultA);
    if (defaultB) ids.add(defaultB);
    return sortSystemIds([...ids]);
  }, [defaultA, defaultB]);

  const [draftSystems, setDraftSystems] = useState(initialDraft);
  const [appliedSystems, setAppliedSystems] = useState([]);
  const [systemsData, setSystemsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alignmentId, setAlignmentId] = useState(ALIGNMENT_NONE);
  const [matrixView, setMatrixView] = useState({ viewStart: 0, viewCount: 0 });
  const [residueViewerTarget, setResidueViewerTarget] = useState(null);

  const alignmentOptions = useMemo(
    () => buildAlignmentOptions(numStates),
    [numStates]
  );

  useEffect(() => {
    if (!alignmentOptions.some((o) => o.id === alignmentId)) {
      setAlignmentId(ALIGNMENT_NONE);
    }
  }, [alignmentOptions, alignmentId]);

  useEffect(() => {
    onActiveMotifChange?.(null);
  }, [numStates, onActiveMotifChange]);

  useEffect(() => {
    if (!comparisonSystemIds.length) return;
    setDraftSystems(sortSystemIds(comparisonSystemIds));
    setAppliedSystems([]);
  }, [comparisonSystemIds]);

  useEffect(() => {
    let cancelled = false;
    setAppliedSystems([]);
    setLoading(true);
    setError(null);

    Promise.all(
      SYSTEM_IDS.map((id) =>
        loadSystemData(id, selectedModel, 'original').then((rows) => [id, rows])
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setSystemsData(Object.fromEntries(entries));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setSystemsData({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel]);

  const slotSourceSystems = useMemo(() => {
    if (appliedSystems.length >= 2) return sortSystemIds(appliedSystems);
    return sortSystemIds(draftSystems);
  }, [appliedSystems, draftSystems]);

  const motifSlotSystems = useMemo(() => {
    const loaded = Object.keys(systemsData).filter((id) => systemsData[id]?.length);
    return sortSystemIds(
      unionSystemIds(comparisonSystemIds, slotSourceSystems, loaded, SYSTEM_IDS)
    );
  }, [comparisonSystemIds, slotSourceSystems, systemsData]);

  const visibleSystems = useMemo(() => {
    if (appliedSystems.length >= 2) return sortSystemIds(appliedSystems);
    const draft = sortSystemIds(draftSystems);
    return draft.length ? [draft[0]] : [];
  }, [appliedSystems, draftSystems]);


  const { columnsBySystem, colCount, matrixSlots: computedMatrixSlots } = useMemo(() => {
    if (!visibleSystems.length) {
      return { columnsBySystem: {}, colCount: 0, matrixSlots: [] };
    }

    const featureMaps = {};
    for (const systemId of visibleSystems) {
      const rows = systemsData[systemId];
      if (rows?.length) {
        featureMaps[systemId] = featuresBySlot(rows, numStates, alignmentId);
      }
    }

    const primaryId = visibleSystems[0];
    if (!featureMaps[primaryId]) {
      return { columnsBySystem: {}, colCount: 0, matrixSlots: [] };
    }

    const slots = buildMatrixSlotsFromRows(
      motifSlotSystems.map((systemId) => systemsData[systemId]).filter(Boolean)
    );

    const columnsBySystem = {};
    for (const systemId of visibleSystems) {
      const map = featureMaps[systemId] || new Map();
      columnsBySystem[systemId] = slots.map((slot) => {
        const features = map.get(slot) || EMPTY;
        return columnFromFeatures(features);
      });
    }

    return {
      columnsBySystem,
      colCount: slots.length,
      matrixSlots: slots,
    };
  }, [visibleSystems, motifSlotSystems, systemsData, numStates, alignmentId]);

  const matrixSlots =
    computedMatrixSlots.length > 0 ? computedMatrixSlots : sharedMatrixSlots;

  const motifGetStates = useCallback(
    (row) => getMatrixStates(row, 'original', alignmentId),
    [alignmentId]
  );

  const motifBundlesBySystem = useMemo(() => {
    const out = {};
    for (const systemId of motifSlotSystems) {
      const rows = systemsData[systemId];
      if (!rows?.length) continue;
      out[systemId] = motifBundlesForSystem(
        activeMotif,
        numStates,
        rows,
        matrixSlots,
        motifGetStates
      );
    }
    return out;
  }, [
    activeMotif,
    numStates,
    motifSlotSystems,
    systemsData,
    matrixSlots,
    motifGetStates,
  ]);

  const traceSystems = useMemo(
    () =>
      visibleSystems
        .filter((id) => systemsData[id]?.length)
        .map((id) => ({
          systemId: id,
          label: SYSTEMS[id]?.label ?? id,
          rows: systemsData[id],
        })),
    [visibleSystems, systemsData]
  );

  const primarySystemId = visibleSystems[0] ?? SYSTEM_IDS[0];

  const activateResidueViewer = useCallback(
    (systemId, rows) => (colIndex) => {
      if (!rows?.length || colIndex < 0 || colIndex >= matrixSlots.length) return;
      const trajs = trajectoriesByMatrixSlot(rows, matrixSlots);
      const row = trajs[colIndex];
      if (!row?.name) return;
      setResidueViewerTarget({
        systemId,
        trajectoryName: row.name,
        frameIndex: 0,
      });
    },
    [matrixSlots]
  );

  useEffect(() => {
    if (matrixSlots.length > 0) {
      onSlotsChange?.(matrixSlots);
    }
  }, [matrixSlots, onSlotsChange]);

  useEffect(() => {
    if (colCount > 0) {
      onSelectionChange?.({ start: 0, end: colCount - 1 });
      setMatrixView(fullView(colCount));
    }
  }, [colCount, onSelectionChange]);

  const handleMatrixViewChange = useCallback(
    ({ anchorCol, deltaY, shiftKey }) => {
      if (colCount <= 0) return;

      setMatrixView((prev) => {
        const current = prev.viewCount || colCount;
        let next;
        if (shiftKey && current < colCount) {
          const step = Math.max(1, Math.round(current * 0.1));
          const deltaCols = deltaY > 0 ? step : -step;
          next = panView(prev.viewStart, current, colCount, deltaCols);
        } else {
          next = zoomView(prev.viewStart, current, colCount, anchorCol, deltaY);
        }

        onSelectionChange?.({
          start: next.viewStart,
          end: next.viewStart + next.viewCount - 1,
        });

        return next;
      });
    },
    [colCount, onSelectionChange]
  );

  const toggleDraftSystem = useCallback((systemId) => {
    setDraftSystems((prev) => {
      const sorted = sortSystemIds(prev);
      if (sorted.includes(systemId)) {
        if (sorted.length === 1) return sorted;
        return sorted.filter((id) => id !== systemId);
      }
      return sortSystemIds([...sorted, systemId]);
    });
    setAppliedSystems([]);
  }, []);

  const handleCompare = useCallback(() => {
    setAppliedSystems(sortSystemIds(draftSystems));
  }, [draftSystems]);

  const canCompare = draftSystems.length >= 2 && !loading && !error;
  const hasPrimaryData = Boolean(systemsData[primarySystemId]?.length);

  return (
    <>
      <div className="compare">
        <div className="compare-toolbar">
          <div className="compare-toolbar-section compare-toolbar-section--systems">
            <span className="panel-field-label compare-systems-label">Systems</span>
            <div
              className="state-driver-system-checks compare-system-checks"
              role="group"
              aria-label="Systems to compare"
            >
              {SYSTEM_IDS.map((systemId) => {
                const checked = draftSystems.includes(systemId);
                const disabled = checked && draftSystems.length === 1;
                return (
                  <label key={systemId} className="state-driver-system-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleDraftSystem(systemId)}
                    />
                    <span
                      className="state-driver-system-check-swatch"
                      data-system={systemId}
                    />
                    {SYSTEMS[systemId].label}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              className="generate-btn compare-toolbar-btn"
              onClick={handleCompare}
              disabled={!canCompare}
            >
              {loading ? 'Loading…' : 'Compare'}
            </button>
          </div>

          <span className="compare-toolbar-divider" aria-hidden="true">
            |
          </span>

          <div className="compare-toolbar-section compare-toolbar-section--alignment">
            <label className="compare-select compare-alignment">
              <span className="panel-field-label">Alignment</span>
              <select
                value={alignmentId}
                onChange={(e) => setAlignmentId(e.target.value)}
              >
                {alignmentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <span className="compare-toolbar-divider" aria-hidden="true">
            |
          </span>

          <div className="compare-toolbar-section compare-toolbar-section--motif">
            {!loading && !error && hasPrimaryData ? (
              <MotifPanel
                numStates={numStates}
                onActiveMotifChange={onActiveMotifChange}
              />
            ) : null}
          </div>
        </div>

        {error && <div className="error-banner compare-banner">{error}</div>}
        {loading && <div className="empty-state compare-banner">Loading…</div>}

        {!loading && !error && hasPrimaryData && (
          <div className="compare-body">
            <div className="compare-matrix-stack">
              {colCount > 0 && (
                <Trace
                  traceSystems={traceSystems}
                  numStates={numStates}
                  matrixSlots={matrixSlots}
                  alignmentId={alignmentId}
                  viewStart={matrixView.viewStart}
                  viewCount={matrixView.viewCount || colCount}
                  numCols={colCount}
                  selection={selection}
                  hoverIndex={hoverIndex}
                  onHoverChange={onHoverChange}
                  onViewChange={handleMatrixViewChange}
                />
              )}

              {visibleSystems.map((systemId, index) => {
                const rows = systemsData[systemId];
                const columns = columnsBySystem[systemId];
                if (!columns?.length || !rows) return null;
                return (
                  <InteractiveMatrix
                    key={`matrix-${systemId}`}
                    columns={columns}
                    numStates={numStates}
                    alignmentId={alignmentId}
                    activeMotif={activeMotif}
                    motifSystemId={systemId}
                    hoveredMotif={hoveredMotif}
                    onMotifHoverChange={onMotifHoverChange}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    hoverIndex={hoverIndex}
                    onHoverChange={onHoverChange}
                    trajectoryRows={rows}
                    matrixSlots={matrixSlots}
                    motifBundles={motifBundlesBySystem[systemId] ?? []}
                    viewStart={matrixView.viewStart}
                    viewCount={matrixView.viewCount || colCount}
                    onViewChange={handleMatrixViewChange}
                    onColumnActivate={activateResidueViewer(systemId, rows)}
                    showColumnLabels={index === 0}
                    sideLabel={SYSTEMS[systemId].label}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!loading && !error && Object.keys(systemsData).length > 0 && (
        <Analysis3D
          systemsData={systemsData}
          defaultSystemId={primarySystemId}
          defaultModelId={selectedModel}
          viewerTarget={residueViewerTarget}
        />
      )}
    </>
  );
}
