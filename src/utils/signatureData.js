import { AB42_RESIDUE_COUNT } from '../components/Analysis3D/Viewer3D/residueSpectrum';
import {
  loadRepresentativeFrameRows,
  loadSignatureResiduals,
  loadStateTrajectoryFrameCounts,
  stateOptionsForModel,
} from './conformationalDriversData';

export { stateOptionsForModel };

function emptyMatrix(size = AB42_RESIDUE_COUNT) {
  return Array.from({ length: size }, () => new Float32Array(size));
}

function setSymmetric(matrix, i, j, value) {
  const a = i - 1;
  const b = j - 1;
  if (a < 0 || b < 0 || a >= matrix.length || b >= matrix.length) return;
  matrix[a][b] = value;
  matrix[b][a] = value;
}

function parsePair(pairStr) {
  const [a, b] = String(pairStr).split('-').map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { i: a, j: b };
}

export function signatureResidualColor(value, maxValue, minValue = 0) {
  const span = maxValue - minValue;
  const t = span > 0 ? Math.max(0, Math.min(1, (value - minValue) / span)) : 0;
  if (t <= 0.5) {
    const u = t / 0.5;
    const r = Math.round(70 + u * (255 - 70));
    const g = Math.round(120 + u * (255 - 120));
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
  const u = (t - 0.5) / 0.5;
  const r = 255;
  const g = Math.round(255 - u * 210);
  const b = Math.round(255 - u * 210);
  return `rgb(${r},${g},${b})`;
}

function percentileValue(sortedValues, percentile) {
  if (!sortedValues.length) return 1;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * percentile))
  );
  return sortedValues[idx];
}

export const STATE_SIGNATURE_DEFAULT_DISPLACEMENT_PERCENT = 1;
/** Top pairs list: |j − i| must be greater than this (same as StateDriver MIN_SEQ_SEP − 1). */
export const SIGNATURE_TOP_PAIR_MIN_SEQ_DIFF = 2;

export function getSignatureResidualMeta(signatureResiduals) {
  const meta = signatureResiduals?._meta ?? {};
  const binWidth = Number(meta.bin_width) || 0.1;
  const maxDistance = Number(meta.max_distance) || 40;
  const nBins = Number(meta.n_bins) || Math.round(maxDistance / binWidth);
  return {
    format: meta.format ?? 'distance_histogram_v2',
    binWidth,
    maxDistance,
    nBins,
  };
}

/** Mean, std, and frame count from histogram (or stored pair_stats). */
export function pairDistanceStats(hist, binWidth, storedStats = null) {
  if (storedStats) {
    const totalFrames = Number(storedStats.n ?? storedStats.total_frames) || 0;
    const mean = Number(storedStats.mean);
    const std = Number(storedStats.std);
    if (Number.isFinite(mean) && Number.isFinite(std) && totalFrames > 0) {
      return { mean, std, totalFrames };
    }
  }

  if (!hist?.length) {
    return { mean: 0, std: 0, totalFrames: 0 };
  }

  let totalFrames = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < hist.length; i += 1) {
    const count = Number(hist[i]) || 0;
    if (!count) continue;
    const distance = (i + 0.5) * binWidth;
    totalFrames += count;
    sum += distance * count;
    sumSq += distance * distance * count;
  }

  if (!totalFrames) {
    return { mean: 0, std: 0, totalFrames: 0 };
  }

  const mean = sum / totalFrames;
  const variance = Math.max(0, sumSq / totalFrames - mean * mean);
  return { mean, std: Math.sqrt(variance), totalFrames };
}

/** Frames with relative displacement |d − μ| / μ ≤ percent/100 for this pair. */
export function countWithinDisplacementPercent(hist, mean, binWidth, displacementPercent) {
  if (!hist?.length || displacementPercent <= 0 || mean <= 0) return 0;
  const rel = displacementPercent / 100;
  const low = mean * (1 - rel);
  const high = mean * (1 + rel);
  let count = 0;
  for (let i = 0; i < hist.length; i += 1) {
    const c = Number(hist[i]) || 0;
    if (!c) continue;
    const distance = (i + 0.5) * binWidth;
    if (distance >= low && distance <= high) count += c;
  }
  return count;
}

function computePairStability(entry, pairKey, displacementPercent, binWidth) {
  const hist = entry?.pair_hist?.[pairKey];
  const stored = entry?.pair_stats?.[pairKey];
  const { mean, std, totalFrames } = pairDistanceStats(hist, binWidth, stored);
  if (!totalFrames || !hist?.length || mean <= 0) return null;

  const stableCount = countWithinDisplacementPercent(
    hist,
    mean,
    binWidth,
    displacementPercent
  );
  const stableFraction = stableCount / totalFrames;

  return {
    mean,
    std,
    totalFrames,
    stableCount,
    stableFraction,
  };
}

export function buildSignatureResidualMatrix(
  signatureResiduals,
  system,
  model,
  trajectoryType,
  selectedState,
  displacementPercent = STATE_SIGNATURE_DEFAULT_DISPLACEMENT_PERCENT
) {
  const key = `${system}|${model}|${trajectoryType}|${selectedState}`;
  const entry = signatureResiduals?.[key];
  const matrix = emptyMatrix();
  const meta = getSignatureResidualMeta(signatureResiduals);
  const usesHistogram = Boolean(entry?.pair_hist);

  if (!entry?.pair_hist) {
    return {
      matrix,
      topPairs: [],
      maxValue: 1,
      minValue: 0,
      frameCount: 0,
      hasData: false,
      displacementPercent,
      usesHistogram: false,
    };
  }

  const pairKeys = Object.keys(entry.pair_hist);
  const pairs = [];

  for (const pairKey of pairKeys) {
    const parsed = parsePair(pairKey);
    if (!parsed || parsed.i === parsed.j) continue;
    const stability = computePairStability(entry, pairKey, displacementPercent, meta.binWidth);
    if (!stability || stability.stableCount <= 0) continue;

    pairs.push({
      i: parsed.i,
      j: parsed.j,
      count: stability.stableCount,
      stableCount: stability.stableCount,
      stableFraction: stability.stableFraction,
      mean: stability.mean,
      std: stability.std,
      totalFrames: stability.totalFrames,
    });
  }

  if (!pairs.length) {
    return {
      matrix,
      topPairs: [],
      maxValue: 1,
      minValue: 0,
      frameCount: 0,
      hasData: false,
      displacementPercent,
      usesHistogram,
    };
  }

  for (const pair of pairs) {
    setSymmetric(matrix, pair.i, pair.j, pair.stableFraction);
  }

  const fractions = pairs.map((p) => p.stableFraction).sort((a, b) => a - b);
  const minValue = percentileValue(fractions, 0.05);
  const maxValue = Math.max(minValue + 0.01, percentileValue(fractions, 0.95));

  const topPairs = [...pairs]
    .filter((pair) => Math.abs(pair.j - pair.i) > SIGNATURE_TOP_PAIR_MIN_SEQ_DIFF)
    .sort(
      (a, b) =>
        b.stableFraction - a.stableFraction ||
        b.stableCount - a.stableCount ||
        a.std - b.std
    )
    .slice(0, 10);

  return {
    matrix,
    topPairs,
    minValue,
    maxValue,
    frameCount: entry.total_frames ?? pairs[0]?.totalFrames ?? 0,
    hasData: usesHistogram,
    displacementPercent,
    usesHistogram,
    meta,
  };
}

export function filterRepresentativesForState(
  rows,
  system,
  model,
  trajectoryType,
  state
) {
  return rows
    .filter(
      (row) =>
        row.system === system &&
        row.model === model &&
        row.trajectory_type === trajectoryType &&
        Number.parseInt(row.state, 10) === state
    )
    .map((row) => ({
      trajectoryName: row.trajectory_name,
      frameIndex: Number.parseInt(row.local_frame, 10),
      rank: Number.parseInt(row.representative_rank, 10),
      score: Number.parseFloat(row.representative_score),
    }))
    .filter((r) => Number.isFinite(r.frameIndex))
    .sort((a, b) => a.rank - b.rank);
}

/**
 * Stacked per-trajectory histogram for Frames tab.
 * Total bar = frames in selectedState (from trajectory.states).
 * Green stack = frames with structural distance to reference <= threshold.
 */
export function buildTrajectoryStateHistogram({
  trajectoryRows = [],
  representatives = [],
  selectedState,
  systemId,
  modelId,
  trajectoryType = 'original',
  frameCountsByGroup = {},
}) {
  const repByTraj = new Map();
  for (const r of representatives) {
    const prev = repByTraj.get(r.trajectoryName);
    if (!prev || r.rank < prev.rank) {
      repByTraj.set(r.trajectoryName, r);
    }
  }

  const groupKey = `${systemId}|${modelId}|${trajectoryType}|${selectedState}`;
  const groupCounts = frameCountsByGroup[groupKey] ?? null;

  const sorted = [...trajectoryRows]
    .map((row) => ({
      name: row.name,
      states: row.states ?? [],
    }))
    .filter((row) => row.states.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  let maxCount = 0;
  let totalStateFrames = 0;
  let totalWithinThreshold = 0;

  const bars = sorted.map((traj, idx) => {
    let stateFrameCount = 0;
    let firstStateFrame = null;
    for (let f = 0; f < traj.states.length; f += 1) {
      if (traj.states[f] !== selectedState) continue;
      stateFrameCount += 1;
      if (firstStateFrame == null) firstStateFrame = f;
    }

    const precomputed = groupCounts?.trajectories?.[traj.name];
    const withinThresholdCount = Math.min(
      stateFrameCount,
      precomputed?.within_threshold ?? 0
    );
    const belowThresholdCount = stateFrameCount - withinThresholdCount;

    totalStateFrames += stateFrameCount;
    totalWithinThreshold += withinThresholdCount;
    maxCount = Math.max(maxCount, stateFrameCount);

    const rep = repByTraj.get(traj.name);
    const frameIndex = rep?.frameIndex ?? firstStateFrame ?? 0;

    return {
      trajectoryIndex: idx + 1,
      trajectoryName: traj.name,
      stateFrameCount,
      withinThresholdCount,
      belowThresholdCount,
      frameIndex,
    };
  });

  const reference =
    groupCounts?.reference ??
    representatives.find((r) => r.rank === 1) ??
    representatives[0] ??
    null;

  return {
    bars,
    maxCount: maxCount || 1,
    totalStateFrames,
    totalWithinThreshold,
    trajectoryCount: sorted.length,
    reference,
    rmsdThreshold: groupCounts?.rmsd_threshold ?? null,
    hasThresholdData: Boolean(groupCounts),
  };
}

export async function loadSignatureSources() {
  const [signatureResiduals, representatives, frameCountsByGroup] = await Promise.all([
    loadSignatureResiduals(),
    loadRepresentativeFrameRows(),
    loadStateTrajectoryFrameCounts(),
  ]);
  return { signatureResiduals, representatives, frameCountsByGroup };
}
