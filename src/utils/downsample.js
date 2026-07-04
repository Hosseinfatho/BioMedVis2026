export const DEFAULT_BINS = 200;

export function downsampleDominantState(states, numBins = DEFAULT_BINS) {
  if (!states.length) return [];
  const binSize = states.length / numBins;
  const result = [];

  for (let b = 0; b < numBins; b++) {
    const start = Math.floor(b * binSize);
    const end = Math.floor((b + 1) * binSize);
    const counts = {};
    for (let i = start; i < end && i < states.length; i++) {
      counts[states[i]] = (counts[states[i]] || 0) + 1;
    }
    let dominant = states[start] ?? 0;
    let maxCount = 0;
    for (const [state, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = parseInt(state, 10);
      }
    }
    result.push(dominant);
  }

  return result;
}

export function downsampleSignalDensity(signal, numBins = DEFAULT_BINS) {
  if (!signal.length) return [];
  const binSize = signal.length / numBins;
  const result = [];

  for (let b = 0; b < numBins; b++) {
    const start = Math.floor(b * binSize);
    const end = Math.floor((b + 1) * binSize);
    const actualSize = Math.max(1, end - start);
    let sum = 0;
    for (let i = start; i < end && i < signal.length; i++) {
      sum += signal[i];
    }
    result.push(sum / actualSize);
  }

  return result;
}
