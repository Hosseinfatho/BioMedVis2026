export function computeStateFeatures(trajectory, numStates, maxLength) {
  const { states, name, length } = trajectory;
  const stateRatios = {};
  const transitionCounts = {};
  const outgoingCounts = {};

  for (let k = 0; k < numStates; k++) {
    stateRatios[k] = 0;
    outgoingCounts[k] = 0;
    for (let j = 0; j < numStates; j++) {
      if (k !== j) transitionCounts[`${k}->${j}`] = 0;
    }
  }

  const stateCounts = {};
  for (let k = 0; k < numStates; k++) stateCounts[k] = 0;

  for (const s of states) {
    if (s >= 0 && s < numStates) stateCounts[s]++;
  }

  for (let k = 0; k < numStates; k++) {
    stateRatios[k] = length > 0 ? stateCounts[k] / length : 0;
  }

  let numStateChanges = 0;
  for (let i = 1; i < states.length; i++) {
    const from = states[i - 1];
    const to = states[i];
    if (from !== to && from >= 0 && from < numStates && to >= 0 && to < numStates) {
      const key = `${from}->${to}`;
      transitionCounts[key]++;
      outgoingCounts[from]++;
      numStateChanges++;
    }
  }

  const transitionRates = {};
  for (let k = 0; k < numStates; k++) {
    for (let j = 0; j < numStates; j++) {
      if (k === j) continue;
      const key = `${k}->${j}`;
      transitionRates[key] =
        outgoingCounts[k] > 0 ? transitionCounts[key] / outgoingCounts[k] : 0;
    }
  }

  let dominantState = 0;
  let maxRatio = -1;
  for (let k = 0; k < numStates; k++) {
    if (stateRatios[k] > maxRatio) {
      maxRatio = stateRatios[k];
      dominantState = k;
    }
  }

  let strongestTransition = null;
  let maxRate = -1;
  for (const [key, rate] of Object.entries(transitionRates)) {
    if (rate > maxRate) {
      maxRate = rate;
      strongestTransition = key;
    }
  }

  return {
    name,
    support: maxLength > 0 ? length / maxLength : 0,
    stateRatios,
    transitionRates,
    transitionCounts,
    numStateChanges,
    dominantState,
    strongestTransition,
  };
}

export function buildFeatureRows(numStates) {
  const rows = [];
  for (let k = 0; k < numStates; k++) {
    rows.push({ type: 'ratio', state: k, label: `State ${k} ratio` });
  }
  for (let i = 0; i < numStates; i++) {
    for (let j = 0; j < numStates; j++) {
      if (i !== j) {
        rows.push({ type: 'transition', from: i, to: j, label: `${i}→${j}` });
      }
    }
  }
  return rows;
}

export function getFeatureValue(features, row) {
  if (row.type === 'ratio') return features.stateRatios[row.state] ?? 0;
  return features.transitionRates[`${row.from}->${row.to}`] ?? 0;
}
