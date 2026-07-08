import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { OUTPUT_DIR } from './paths.js';
import { buildAllConcatLookups } from './buildConcatLookup.js';
import { rowToCsvLine } from './writeFrameIndexCsv.js';
import {
  createStructuralReaders,
  ensureStructuralIndexDb,
  parseCsvLine,
  resolveStructuralParts,
} from './structuralIndexDb.js';

const FRAME_INDEX_PATH = path.join(OUTPUT_DIR, 'frame_index.csv');
const STRUCTURAL_PATH = path.join(OUTPUT_DIR, 'frame_structural_features.csv');
const DEFAULT_TOP_K = 5;

export const REPRESENTATIVE_FRAME_COLUMNS = [
  'system',
  'model',
  'trajectory_type',
  'state',
  'trajectory_name',
  'local_frame',
  'xtc_frame_index',
  'representative_rank',
  'representative_score',
];

function createCentroidGroup(dims) {
  return {
    count: 0,
    sum: new Array(dims).fill(0),
  };
}

function addVector(group, vector) {
  group.count += 1;
  for (let i = 0; i < vector.length; i++) {
    group.sum[i] += vector[i];
  }
}

function centroidFromGroup(group) {
  if (!group.count) return null;
  return group.sum.map((value) => value / group.count);
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function createTopK(topK) {
  return {
    topK,
    items: [],
  };
}

function considerCandidate(store, candidate) {
  store.items.push(candidate);
  store.items.sort((a, b) => a.representative_score - b.representative_score);
  if (store.items.length > store.topK) {
    store.items.length = store.topK;
  }
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

export async function buildRepresentativeFrames({
  frameIndexPath = FRAME_INDEX_PATH,
  structuralPath = STRUCTURAL_PATH,
  outputPath = path.join(OUTPUT_DIR, 'representative_frames.csv'),
  topK = DEFAULT_TOP_K,
} = {}) {
  process.stdout.write('Building structural index database… ');
  const { db } = await ensureStructuralIndexDb({ structuralPath });
  process.stdout.write('done\n');

  const readers = createStructuralReaders(db);
  const concatLookups = buildAllConcatLookups();
  const centroidGroups = new Map();

  let matched = 0;
  let scanned = 0;

  await streamFrameIndex(frameIndexPath, (row) => {
    scanned += 1;
    const parts = resolveStructuralParts(row, concatLookups);
    if (!parts) return;

    const vector = readers.readFeatureVector(
      parts.system,
      parts.trajectoryName,
      parts.xtcFrameIndex
    );
    if (!vector) return;

    matched += 1;
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    if (!centroidGroups.has(groupKey)) {
      centroidGroups.set(groupKey, createCentroidGroup(vector.length));
    }
    addVector(centroidGroups.get(groupKey), vector);
  });

  const centroids = new Map();
  for (const [groupKey, group] of centroidGroups) {
    const centroid = centroidFromGroup(group);
    if (centroid) centroids.set(groupKey, centroid);
  }

  const topKStores = new Map();
  for (const groupKey of centroids.keys()) {
    topKStores.set(groupKey, createTopK(topK));
  }

  await streamFrameIndex(frameIndexPath, (row) => {
    const parts = resolveStructuralParts(row, concatLookups);
    if (!parts) return;

    const vector = readers.readFeatureVector(
      parts.system,
      parts.trajectoryName,
      parts.xtcFrameIndex
    );
    if (!vector) return;

    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    const centroid = centroids.get(groupKey);
    const store = topKStores.get(groupKey);
    if (!centroid || !store) return;

    considerCandidate(store, {
      system: row.system,
      model: row.model,
      trajectory_type: row.trajectory_type,
      state: Number.parseInt(row.state, 10),
      trajectory_name: row.trajectory_name,
      local_frame: row.local_frame,
      xtc_frame_index: row.xtc_frame_index,
      representative_score: euclideanDistance(vector, centroid),
    });
  });

  const outputRows = [];
  for (const store of topKStores.values()) {
    store.items
      .sort((a, b) => a.representative_score - b.representative_score)
      .forEach((item, index) => {
        outputRows.push({
          ...item,
          representative_rank: index + 1,
          representative_score: Number(item.representative_score.toFixed(6)),
        });
      });
  }

  outputRows.sort(
    (a, b) =>
      a.system.localeCompare(b.system) ||
      a.model.localeCompare(b.model) ||
      a.trajectory_type.localeCompare(b.trajectory_type) ||
      a.state - b.state ||
      a.representative_rank - b.representative_rank
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const lines = [REPRESENTATIVE_FRAME_COLUMNS.join(',')];
  for (const row of outputRows) {
    lines.push(rowToCsvLine(row, REPRESENTATIVE_FRAME_COLUMNS));
  }
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');

  return {
    scanned,
    matched,
    groupCount: centroids.size,
    rowCount: outputRows.length,
    outputPath,
  };
}
