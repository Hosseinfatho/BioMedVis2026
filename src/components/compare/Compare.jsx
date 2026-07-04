import { useState, useEffect, useMemo } from 'react';
import { SYSTEMS, MODELS } from '../../config/dataFiles';
import { loadSystemData } from '../../utils/loadSystemData';
import {
  computeTrajectoryFeatures,
  getRowStates,
} from '../../utils/computeTransitionFeatures';
import InteractiveMatrix from './InteractiveMatrix';

// Trajectory names look like `e10s10_e3s15p0f841`. The part before `_` is the
// adaptive-sampling slot and exists in every system, so we use it to match the
// same slot across two systems.
function slotKey(name) {
  return name.split('_')[0];
}

function featuresBySlot(rows, viewMode, numStates) {
  const map = new Map();
  rows.forEach((row) => {
    const key = slotKey(row.name);
    if (map.has(key)) return;
    map.set(key, computeTrajectoryFeatures(getRowStates(row, viewMode), numStates));
  });
  return map;
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

const EMPTY = { stateRatios: [], transitionRatios: {} };

export default function Compare({
  selectedModel,
  viewMode,
  numStates,
  defaultA,
  defaultB,
  selection,
  onSelectionChange,
  hoverIndex,
  onHoverChange,
}) {
  const systemIds = Object.keys(SYSTEMS);
  const [systemA, setSystemA] = useState(defaultA || systemIds[0]);
  const [systemB, setSystemB] = useState(defaultB || systemIds[1] || systemIds[0]);
  // the difference view only appears after the user presses "Compare"
  const [applied, setApplied] = useState(false);
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // load both systems whenever the selection / model / view changes; changing
  // any of them hides the comparison until "Compare" is pressed again.
  useEffect(() => {
    let cancelled = false;
    setApplied(false);
    setLoading(true);
    setError(null);

    Promise.all([
      loadSystemData(systemA, selectedModel, viewMode),
      loadSystemData(systemB, selectedModel, viewMode),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        setDataA(a);
        setDataB(b);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setDataA(null);
        setDataB(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [systemA, systemB, selectedModel, viewMode]);

  // A single shared column order (System A's natural order, then any B-only
  // slots) so System A, System B and the difference line up home-by-home.
  const { columnsA, columnsB, columnsDiff, colCount } = useMemo(() => {
    if (!dataA) {
      return { columnsA: [], columnsB: [], columnsDiff: [], colCount: 0 };
    }

    const mapA = featuresBySlot(dataA, viewMode, numStates);
    const mapB = dataB ? featuresBySlot(dataB, viewMode, numStates) : new Map();
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
    for (const s of mapB.keys()) {
      if (!seen.has(s)) {
        seen.add(s);
        slots.push(s);
      }
    }

    const cA = [];
    const cB = [];
    const cD = [];
    for (const slot of slots) {
      const a = mapA.get(slot) || EMPTY;
      const b = mapB.get(slot) || EMPTY;

      cA.push({ stateVals: a.stateRatios, transitionVals: a.transitionRatios });
      cB.push({ stateVals: b.stateRatios, transitionVals: b.transitionRatios });

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
      cD.push({ stateVals: stateDiff, transitionVals: transitionDiff });
    }

    return { columnsA: cA, columnsB: cB, columnsDiff: cD, colCount: slots.length };
  }, [dataA, dataB, viewMode, numStates]);

  // reset the shared window to cover all trajectories whenever the data changes
  useEffect(() => {
    if (colCount > 0) onSelectionChange?.({ start: 0, end: colCount - 1 });
  }, [colCount, onSelectionChange]);

  const sameSystem = systemA === systemB;
  const showResult = applied && !loading && !error && !sameSystem;

  return (
    <div className="compare">
      <div className="compare-controls">
        <label className="compare-select">
          System A
          <select value={systemA} onChange={(e) => setSystemA(e.target.value)}>
            {systemIds.map((id) => (
              <option key={id} value={id}>
                {SYSTEMS[id].label} ({id})
              </option>
            ))}
          </select>
        </label>
        <span className="compare-vs">vs</span>
        <label className="compare-select">
          System B
          <select value={systemB} onChange={(e) => setSystemB(e.target.value)}>
            {systemIds.map((id) => (
              <option key={id} value={id}>
                {SYSTEMS[id].label} ({id})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="generate-btn"
          onClick={() => setApplied(true)}
          disabled={loading || sameSystem}
        >
          {loading ? 'Loading…' : 'Compare'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="empty-state">Loading…</div>}

      {/* first: just the System A matrix */}
      {!loading && !error && dataA && (
        <>
          <div className="compare-title">
            System A — {SYSTEMS[systemA].label} ({systemA}) ·{' '}
            {MODELS[selectedModel].label}
          </div>
          <InteractiveMatrix
            columns={columnsA}
            numStates={numStates}
            selection={selection}
            onSelectionChange={onSelectionChange}
            hoverIndex={hoverIndex}
            onHoverChange={onHoverChange}
          />
        </>
      )}

      {/* after pressing Compare: System B + the difference */}
      {showResult && (
        <>
          <div className="compare-title">
            System B — {SYSTEMS[systemB].label} ({systemB}) ·{' '}
            {MODELS[selectedModel].label}
          </div>
          <InteractiveMatrix
            columns={columnsB}
            numStates={numStates}
            selection={selection}
            onSelectionChange={onSelectionChange}
            hoverIndex={hoverIndex}
            onHoverChange={onHoverChange}
          />

          <div className="compare-title">
            Difference |A − B| · {colCount} trajectories
          </div>
          <InteractiveMatrix
            columns={columnsDiff}
            numStates={numStates}
            selection={selection}
            onSelectionChange={onSelectionChange}
            hoverIndex={hoverIndex}
            onHoverChange={onHoverChange}
          />
        </>
      )}
    </div>
  );
}
