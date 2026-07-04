// Builds the ordered list of matrix rows for a given state model:
//   first one row per state (S0, S1, ...),
//   then one row per directed transition (S0->S1, S0->S2, S1->S0, ...).
// state-2 => 2 + 2 = 4 rows, state-3 => 3 + 6 = 9, state-4 => 4 + 12 = 16.
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

  return { stateRatios, transitionRatios, total, totalTransitions };
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
