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
import {
  motifBundlesForSystem,
} from '../../utils/motifs';
import { slotKey } from '../../utils/slotKey';
import { trajectoriesByMatrixSlot } from '../../utils/matrixRepresentativeRows';
import InteractiveMatrix from './InteractiveMatrix';
import MotifPanel from './MotifPanel';
import Trace from '../Trace';
import Analysis3D from '../Analysis3D/Analysis3D';

const SYSTEM_IDS = Object.keys(SYSTEMS);

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

function transitionKeys(numStates) {
  const keys = [];
  for (let a = 0; a < numStates; a++) {
    for (let b = 0; b < numStates; b++) {
      if (a !== b) keys.push(`${a}->${b}`);
    }
  }
  return keys;
}

const EMPTY = {
  stateRatios: [],
  transitionRatios: {},
  stateCounts: [],
  transitionCounts: {},
  total: 0,
  totalTransitions: 0,
};

export default function Compare({
  selectedModel,
  numStates,
  defaultA,
  defaultB,
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
  const [systemA, setSystemA] = useState(defaultA || SYSTEM_IDS[0]);
  const [systemB, setSystemB] = useState(defaultB || SYSTEM_IDS[1] || SYSTEM_IDS[0]);
  // the difference view only appears after the user presses "Compare"
  const [applied, setApplied] = useState(false);
  const [systemsData, setSystemsData] = useState({});
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
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

  // Matrices always use original per-trajectory data; chart view mode does not
  // affect columns, brush, or Rate aggregation.
  useEffect(() => {
    let cancelled = false;
    setApplied(false);
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

  useEffect(() => {
    if (!Object.keys(systemsData).length) {
      setDataA(null);
      setDataB(null);
      return;
    }
    setDataA(systemsData[systemA] ?? null);
    setDataB(systemsData[systemB] ?? null);
  }, [systemA, systemB, systemsData]);

  // A single shared column order (System A's natural order, then any B-only
  // slots) so System A, System B and the difference line up home-by-home.
  const { columnsA, columnsB, columnsDiff, colCount, matrixSlots } = useMemo(() => {
    if (!dataA) {
      return {
        columnsA: [],
        columnsB: [],
        columnsDiff: [],
        colCount: 0,
        matrixSlots: [],
      };
    }

    const mapA = featuresBySlot(dataA, numStates, alignmentId);
    const mapB = dataB ? featuresBySlot(dataB, numStates, alignmentId) : new Map();
    const tKeys = transitionKeys(numStates);

    const slots = [];
    const seen = new Set();
    for (const row of dataA) {
      const s = slotKey(row.name);
      if (!seen.has(s)) {
        seen.add(s);
        slots.push(s);
      }
    }
    if (dataB) {
      for (const row of dataB) {
        const s = slotKey(row.name);
        if (s && !seen.has(s)) {
          seen.add(s);
          slots.push(s);
        }
      }
    }

    const cA = [];
    const cB = [];
    const cD = [];
    for (const slot of slots) {
      const a = mapA.get(slot) || EMPTY;
      const b = mapB.get(slot) || EMPTY;

      cA.push({
        stateVals: a.stateRatios,
        transitionVals: a.transitionRatios,
        stateCounts: a.stateCounts,
        transitionCounts: a.transitionCounts,
        totalFrames: a.total,
        totalTransitions: a.totalTransitions,
        states: a.states,
      });
      cB.push({
        stateVals: b.stateRatios,
        transitionVals: b.transitionRatios,
        stateCounts: b.stateCounts,
        transitionCounts: b.transitionCounts,
        totalFrames: b.total,
        totalTransitions: b.totalTransitions,
        states: b.states,
      });

      const stateDiff = [];
      for (let s = 0; s < numStates; s++) {
        stateDiff.push(
          Math.abs((a.stateRatios[s] || 0) - (b.stateRatios[s] || 0))
        );
      }
      const transitionDiff = {};
      for (const key of tKeys) {
        transitionDiff[key] = Math.abs(
          (a.transitionRatios[key] || 0) - (b.transitionRatios[key] || 0)
        );
      }
      cD.push({
        stateVals: stateDiff,
        transitionVals: transitionDiff,
        states: a.states,
        statesB: b.states,
      });
    }

    return {
      columnsA: cA,
      columnsB: cB,
      columnsDiff: cD,
      colCount: slots.length,
      matrixSlots: slots,
    };
  }, [dataA, dataB, numStates, alignmentId]);

  const motifGetStates = useCallback((row) => row.states || [], []);

  const motifBundlesA = useMemo(
    () => motifBundlesForSystem(activeMotif, numStates, dataA, matrixSlots, motifGetStates),
    [activeMotif, numStates, dataA, matrixSlots, motifGetStates]
  );

  const motifBundlesB = useMemo(
    () =>
      dataB
        ? motifBundlesForSystem(activeMotif, numStates, dataB, matrixSlots, motifGetStates)
        : [],
    [activeMotif, numStates, dataB, matrixSlots, motifGetStates]
  );

  const motifBundlesDiff = useMemo(() => {
    if (!activeMotif) return [];
    let nextIdx = 0;
    const merged = [];
    for (const bundle of motifBundlesA) {
      merged.push({ ...bundle, occurrenceIndex: nextIdx++ });
    }
    for (const bundle of motifBundlesB) {
      merged.push({ ...bundle, occurrenceIndex: nextIdx++ });
    }
    return merged;
  }, [activeMotif, motifBundlesA, motifBundlesB]);

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
    onSlotsChange?.(matrixSlots);
  }, [matrixSlots, onSlotsChange]);

  // reset the shared window to cover all trajectories whenever the data changes
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

  const sameSystem = systemA === systemB;
  const showResult = applied && !loading && !error && !sameSystem && !!dataB;

  return (
    <>
      <div className="compare">
        <div className="compare-toolbar">
          <div className="compare-toolbar-section compare-toolbar-section--systems">
            <label className="compare-select">
              <span className="panel-field-label">System A</span>
              <select value={systemA} onChange={(e) => setSystemA(e.target.value)}>
                {SYSTEM_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SYSTEMS[id].label}
                  </option>
                ))}
              </select>
            </label>
            <span className="compare-vs">vs</span>
            <label className="compare-select">
              <span className="panel-field-label">System B</span>
              <select value={systemB} onChange={(e) => setSystemB(e.target.value)}>
                {SYSTEM_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SYSTEMS[id].label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="generate-btn compare-toolbar-btn"
              onClick={() => setApplied(true)}
              disabled={loading || sameSystem}
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
            {!loading && !error && dataA ? (
              <MotifPanel
                numStates={numStates}
                onActiveMotifChange={onActiveMotifChange}
              />
            ) : null}
          </div>
        </div>

        {error && <div className="error-banner compare-banner">{error}</div>}
        {loading && <div className="empty-state compare-banner">Loading…</div>}

        {!loading && !error && dataA && (
          <div className="compare-body">
            <div className="compare-matrix-stack">
          {colCount > 0 && (
            <Trace
              dataA={dataA}
              dataB={showResult ? dataB : null}
              systemALabel={SYSTEMS[systemA]?.label || systemA}
              systemBLabel={SYSTEMS[systemB]?.label || systemB}
              canCompare={showResult}
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

          <InteractiveMatrix
            key={`matrix-${systemA}`}
            columns={columnsA}
            numStates={numStates}
            alignmentId={alignmentId}
            activeMotif={activeMotif}
            motifSystemId={systemA}
            hoveredMotif={hoveredMotif}
            onMotifHoverChange={onMotifHoverChange}
            selection={selection}
            onSelectionChange={onSelectionChange}
            hoverIndex={hoverIndex}
            onHoverChange={onHoverChange}
            trajectoryRows={dataA}
            matrixSlots={matrixSlots}
            motifBundles={motifBundlesA}
            viewStart={matrixView.viewStart}
            viewCount={matrixView.viewCount || colCount}
            onViewChange={handleMatrixViewChange}
            onColumnActivate={activateResidueViewer(systemA, dataA)}
            showColumnLabels
            sideLabel={SYSTEMS[systemA].label}
          />

          {showResult && (
            <>
              <InteractiveMatrix
                key={`matrix-${systemB}`}
                columns={columnsB}
                numStates={numStates}
                alignmentId={alignmentId}
                activeMotif={activeMotif}
                motifSystemId={systemB}
                hoveredMotif={hoveredMotif}
                onMotifHoverChange={onMotifHoverChange}
                selection={selection}
                onSelectionChange={onSelectionChange}
                hoverIndex={hoverIndex}
                onHoverChange={onHoverChange}
                trajectoryRows={dataB}
                matrixSlots={matrixSlots}
                motifBundles={motifBundlesB}
                viewStart={matrixView.viewStart}
                viewCount={matrixView.viewCount || colCount}
                onViewChange={handleMatrixViewChange}
                onColumnActivate={activateResidueViewer(systemB, dataB)}
                sideLabel={SYSTEMS[systemB].label}
              />

              <InteractiveMatrix
                key="matrix-diff"
                columns={columnsDiff}
                numStates={numStates}
                alignmentId={alignmentId}
                activeMotif={activeMotif}
                motifSystemId="__diff__"
                hoveredMotif={hoveredMotif}
                onMotifHoverChange={onMotifHoverChange}
                selection={selection}
                onSelectionChange={onSelectionChange}
                hoverIndex={hoverIndex}
                onHoverChange={onHoverChange}
                trajectoryRows={dataA}
                trajectoryRowsB={dataB}
                matrixSlots={matrixSlots}
                motifBundles={motifBundlesDiff}
                viewStart={matrixView.viewStart}
                viewCount={matrixView.viewCount || colCount}
                onViewChange={handleMatrixViewChange}
                onColumnActivate={activateResidueViewer(systemA, dataA)}
                rateMode="diff"
                sideLabel="Difference"
              />
            </>
          )}
            </div>
          </div>
        )}
      </div>

      {!loading && !error && Object.keys(systemsData).length > 0 && (
        <Analysis3D
          systemsData={systemsData}
          defaultSystemId={systemA}
          defaultModelId={selectedModel}
          viewerTarget={residueViewerTarget}
        />
      )}
    </>
  );
}
