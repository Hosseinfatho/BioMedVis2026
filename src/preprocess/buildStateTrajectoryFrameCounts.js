import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { OUTPUT_DIR } from './paths.js';
import { buildAllConcatLookups } from './buildConcatLookup.js';
import {
  createStructuralReaders,
  openStructuralIndexDb,
  parseCsvLine,
  resolveStructuralParts,
} from './structuralIndexDb.js';

const FRAME_INDEX_PATH = path.join(OUTPUT_DIR, 'frame_index.csv');
const REPRESENTATIVE_PATH = path.join(OUTPUT_DIR, 'representative_frames.csv');
const DEFAULT_OUTPUT = path.join(OUTPUT_DIR, 'state_trajectory_frame_counts.json');
export const DEFAULT_PERCENTILE = 10;

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function createCentroidGroup(dims) {
  return { count: 0, sum: new Array(dims).fill(0) };
}

function addVector(group, vector) {
  group.count += 1;
  for (let i = 0; i < vector.length; i += 1) {
    group.sum[i] += vector[i];
  }
}

function centroidFromGroup(group) {
  if (!group.count) return null;
  return group.sum.map((value) => value / group.count);
}

function percentileThreshold(distances, percentile) {
  if (!distances.length) return 0;
  const sorted = distances.slice().sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * (percentile / 100)))
  );
  return sorted[rank];
}

async function loadRepresentativesByGroup(representativePath) {
  const byGroup = new Map();
  if (!fs.existsSync(representativePath)) return byGroup;

  const stream = fs.createReadStream(representativePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((col, i) => [col, values[i]]));
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
    byGroup.get(groupKey).push({
      trajectoryName: row.trajectory_name,
      localFrame: Number.parseInt(row.local_frame, 10),
      rank: Number.parseInt(row.representative_rank, 10),
    });
  }

  for (const reps of byGroup.values()) {
    reps.sort((a, b) => a.rank - b.rank);
  }
  return byGroup;
}

async function streamFrameIndex(frameIndexPath, onRow) {
  const stream = fs.createReadStream(frameIndexPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((col, i) => [col, values[i]]));
    await onRow(row);
  }
}

export async function buildStateTrajectoryFrameCounts({
  frameIndexPath = FRAME_INDEX_PATH,
  representativePath = REPRESENTATIVE_PATH,
  outputPath = DEFAULT_OUTPUT,
  thresholdPercentile = DEFAULT_PERCENTILE,
} = {}) {
  if (!fs.existsSync(frameIndexPath)) {
    throw new Error(`Missing ${frameIndexPath}. Run preprocess:frame-index first.`);
  }

  const representativesByGroup = await loadRepresentativesByGroup(representativePath);
  const { db } = openStructuralIndexDb();
  const readers = createStructuralReaders(db);
  const concatLookups = buildAllConcatLookups();

  const centroidGroups = new Map();
  let scanned = 0;
  let matched = 0;

  await streamFrameIndex(frameIndexPath, (row) => {
    scanned += 1;
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    if (!representativesByGroup.has(groupKey)) return;

    const parts = resolveStructuralParts(row, concatLookups);
    if (!parts) return;

    const vector = readers.readFeatureVector(
      parts.system,
      parts.trajectoryName,
      parts.xtcFrameIndex
    );
    if (!vector) return;

    matched += 1;
    if (!centroidGroups.has(groupKey)) {
      centroidGroups.set(groupKey, createCentroidGroup(vector.length));
    }
    addVector(centroidGroups.get(groupKey), vector);
  });

  const groupMeta = new Map();
  for (const [groupKey, reps] of representativesByGroup) {
    const centroid = centroidFromGroup(centroidGroups.get(groupKey));
    if (!centroid) continue;

    const ref = reps.find((r) => r.rank === 1) ?? reps[0];
    groupMeta.set(groupKey, {
      reference: {
        trajectory_name: ref.trajectoryName,
        local_frame: ref.localFrame,
      },
      centroid,
      distances: [],
      records: [],
      trajectories: new Map(),
    });
  }

  await streamFrameIndex(frameIndexPath, (row) => {
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    const meta = groupMeta.get(groupKey);
    if (!meta) return;

    const parts = resolveStructuralParts(row, concatLookups);
    if (!parts) return;

    const vector = readers.readFeatureVector(
      parts.system,
      parts.trajectoryName,
      parts.xtcFrameIndex
    );
    if (!vector) return;

    const trajName = row.trajectory_name;
    if (!meta.trajectories.has(trajName)) {
      meta.trajectories.set(trajName, { state_frames: 0, within_threshold: 0 });
    }
    meta.trajectories.get(trajName).state_frames += 1;

    const distToCentroid = euclideanDistance(vector, meta.centroid);
    meta.distances.push(distToCentroid);
    meta.records.push({ trajName, distToCentroid });
  });

  const output = {};
  for (const [groupKey, meta] of groupMeta) {
    const threshold = percentileThreshold(meta.distances, thresholdPercentile);
    for (const record of meta.records) {
      if (record.distToCentroid > threshold) continue;
      meta.trajectories.get(record.trajName).within_threshold += 1;
    }

    const trajectories = {};
    for (const [name, counts] of meta.trajectories) {
      trajectories[name] = counts;
    }
    output[groupKey] = {
      reference: meta.reference,
      rmsd_threshold: Number(threshold.toFixed(6)),
      threshold_percentile: thresholdPercentile,
      trajectories,
    };
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, 'utf8');

  return {
    scanned,
    matched,
    groupCount: groupMeta.size,
    outputPath,
    thresholdPercentile,
  };
}
