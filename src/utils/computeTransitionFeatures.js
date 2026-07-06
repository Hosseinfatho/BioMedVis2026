import { getAlignedStates } from './alignment';
import { slotKey } from './slotKey';

// Builds the ordered list of matrix rows for a given state model:
//   first one row per state (S0, S1, ...),
//   then one row per directed transition (S0->S1, S0->S2, S1->S0, ...).
export function buildFeatureRows(numStates) {
  const featureRows = [];

  for (let s = 0; s < numStates; s++) {
    featureRows.push({ type: 'state', state: s, label: `S${s}` });
  }

  for (let a = 0; a < numStates; a++) {
    for (let b = 0; b < numStates; b++) {
      if (a !== b) {
        featureRows.push({
          type: 'transition',
          from: a,
          to: b,
          label: `S${a}->S${b}`,
        });
      }
    }
  }

  return featureRows;
}

// Row index in buildFeatureRows() for a directed transition S{from}->S{to}.
export function featureRowIndexForTransition(from, to, numStates) {
  let idx = numStates;
  for (let a = 0; a < numStates; a++) {
    for (let b = 0; b < numStates; b++) {
      if (a === b) continue;
      if (a === from && b === to) return idx;
      idx++;
    }
  }
  return -1;
}

// For a single trajectory (array of per-frame state indices) computes:
//   stateRatios[s]      = frames in state s / total frames        (0..1)
//   transitionRatios[k] = count of transition k / total transitions (0..1)
// where k is the string `${from}->${to}`.
export function computeTrajectoryFeatures(states, numStates) {
  const stateCounts = new Array(numStates).fill(0);
  const transitionCounts = {};
  let totalTransitions = 0;
  const total = states.length;

  for (let i = 0; i < total; i++) {
    const s = states[i];
    if (s >= 0 && s < numStates) stateCounts[s]++;

    if (i > 0) {
      const prev = states[i - 1];
      if (prev !== s) {
        const key = `${prev}->${s}`;
        transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        totalTransitions++;
      }
    }
  }

  const stateRatios = stateCounts.map((c) => (total > 0 ? c / total : 0));
  const transitionRatios = {};
  for (const key in transitionCounts) {
    transitionRatios[key] =
      totalTransitions > 0 ? transitionCounts[key] / totalTransitions : 0;
  }

  return {
    stateRatios,
    transitionRatios,
    stateCounts,
    transitionCounts,
    total,
    totalTransitions,
  };
}

// Count directed state changes in one trajectory (frame sequence).
// transCounts[from][to] increments for each change from `from` to `to`.
function countChangesInSequence(states, numStates, transCounts, stateCounts) {
  const n = numStates;
  let frameCount = 0;
  if (!states?.length) return frameCount;

  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    if (s >= 0 && s < n) stateCounts[s]++;
    if (i > 0) {
      const prev = states[i - 1];
      if (prev !== s && prev >= 0 && prev < n && s >= 0 && s < n) {
        transCounts[prev][s]++;
      }
    }
  }
  return states.length;
}

// Scale values so they sum to exactly 1 (guards against float drift).
function normalizeSumOne(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum <= 0) return values.map(() => 0);
  return values.map((v) => v / sum);
}

// Pools all trajectories whose slot falls inside the brushed column window.
// Diagonal: state i / sum(all states) → always sums to 100%.
// Off-diagonal: change i→j / sum(all directed changes) → always sums to 100%.
export function aggregateRateFromWindow(
  startCol,
  endCol,
  numStates,
  { allRows, matrixSlots, alignmentId } = {}
) {
  const n = numStates;
  const stateCounts = new Array(n).fill(0);
  const transCounts = Array.from({ length: n }, () => new Array(n).fill(0));
  let trajCount = 0;

  const a = Math.max(0, startCol);
  const b = matrixSlots ? Math.min(matrixSlots.length - 1, endCol) : endCol;

  if (allRows?.length && matrixSlots?.length && b >= a) {
    for (let c = a; c <= b; c++) {
      const slot = matrixSlots[c];
      if (!slot) continue;

      for (const row of allRows) {
        if (slotKey(row.name) !== slot) continue;
        trajCount++;
        const states = getMatrixStates(row, 'original', alignmentId);
        countChangesInSequence(states, n, transCounts, stateCounts);
      }
    }
  }

  let totalChanges = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) totalChanges += transCounts[i][j];
    }
  }

  const stateTotal = stateCounts.reduce((s, c) => s + c, 0);
  const sAvg = normalizeSumOne(stateCounts);

  const tAvg = Array.from({ length: n }, () => new Array(n).fill(0));
  if (totalChanges > 0) {
    const flat = [];
    const coords = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        flat.push(transCounts[i][j]);
        coords.push([i, j]);
      }
    }
    const normed = normalizeSumOne(flat);
    coords.forEach(([i, j], k) => {
      tAvg[i][j] = normed[k];
    });
  }

  return {
    stateAvg: sAvg,
    stateCounts,
    transAvg: tAvg,
    transCounts,
    totalChanges,
    totalFrames: stateTotal,
    trajCount,
    windowStart: a,
    windowEnd: b,
  };
}

// |rate A − rate B| per cell; diagonal = |state occupancy A − B|.
export function diffRateMatrices(rateA, rateB, numStates) {
  const n = numStates;
  const transAvg = Array.from({ length: n }, () => new Array(n).fill(0));
  const transCounts = Array.from({ length: n }, () => new Array(n).fill(0));
  const transAvgA = Array.from({ length: n }, () => new Array(n).fill(0));
  const transAvgB = Array.from({ length: n }, () => new Array(n).fill(0));
  const stateAvg = new Array(n).fill(0);
  const stateAvgA = rateA.stateAvg || [];
  const stateAvgB = rateB.stateAvg || [];
  const stateCounts = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const a = stateAvgA[i] || 0;
    const b = stateAvgB[i] || 0;
    stateAvg[i] = Math.abs(a - b);
    stateCounts[i] = Math.abs(
      (rateA.stateCounts?.[i] || 0) - (rateB.stateCounts?.[i] || 0)
    );
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = rateA.transAvg[i][j] || 0;
      const b = rateB.transAvg[i][j] || 0;
      transAvgA[i][j] = a;
      transAvgB[i][j] = b;
      transAvg[i][j] = Math.abs(a - b);
      transCounts[i][j] = Math.abs(
        (rateA.transCounts[i][j] || 0) - (rateB.transCounts[i][j] || 0)
      );
    }
  }

  return {
    stateAvg,
    stateCounts,
    stateAvgA,
    stateAvgB,
    stateCountsA: rateA.stateCounts,
    stateCountsB: rateB.stateCounts,
    transAvg,
    transCounts,
    transAvgA,
    transAvgB,
    countsA: rateA.transCounts,
    countsB: rateB.transCounts,
    totalChangesA: rateA.totalChanges,
    totalChangesB: rateB.totalChanges,
    totalFramesA: rateA.totalFrames,
    totalFramesB: rateB.totalFrames,
    trajCount: rateA.trajCount,
    windowStart: rateA.windowStart,
    windowEnd: rateA.windowEnd,
  };
}

// Returns the full per-frame state array for a row, handling both view modes.
export function getRowStates(row, viewMode) {
  if (viewMode === 'concatenated') {
    const all = [];
    for (const seg of row.segments) {
      for (const v of seg.states) all.push(v);
    }
    return all;
  }
  return row.states || [];
}

// Full trajectory or aligned window around a transition/entry event.
export function getMatrixStates(row, viewMode, alignmentId) {
  const raw = getRowStates(row, viewMode);
  return getAlignedStates(raw, alignmentId);
}
