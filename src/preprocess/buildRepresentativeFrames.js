import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { OUTPUT_DIR } from './paths.js';
import { buildAllConcatLookups } from './buildConcatLookup.js';
import { rowToCsvLine } from './writeFrameIndexCsv.js';

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

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

function featureVector(structural) {
  const kd = structural.contact_features?.key_distances || {};
  return [
    structural.rmsd,
    structural.radius_of_gyration,
    kd['1-42'] ?? 0,
    kd['1-28'] ?? 0,
    kd['17-42'] ?? 0,
    kd['11-42'] ?? 0,
    kd['18-42'] ?? 0,
  ];
}

function centroid(vectors) {
  const dims = vectors[0].length;
  const mean = new Array(dims).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dims; i++) {
      mean[i] += vector[i];
    }
  }
  for (let i = 0; i < dims; i++) {
    mean[i] /= vectors.length;
  }
  return mean;
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

async function loadStructuralMap(structuralPath = STRUCTURAL_PATH) {
  if (!fs.existsSync(structuralPath)) {
    throw new Error(`Missing ${structuralPath}. Run preprocess:frame-structural first.`);
  }

  const map = new Map();
  const stream = fs.createReadStream(structuralPath, { encoding: 'utf8' });
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
    const key = `${row.system}|${row.trajectory_name}|${row.xtc_frame_index}`;

    map.set(key, {
      rmsd: Number.parseFloat(row.rmsd),
      radius_of_gyration: Number.parseFloat(row.radius_of_gyration),
      contact_features: JSON.parse(row.contact_features),
      ligand_contact_features: JSON.parse(row.ligand_contact_features),
    });
  }

  return map;
}

function resolveStructuralKey(row, concatLookups) {
  if (row.trajectory_type === 'original') {
    return `${row.system}|${row.trajectory_name}|${row.xtc_frame_index}`;
  }

  const lookup = concatLookups.get(row.system);
  const resolved = lookup?.get(`${row.trajectory_name}|${row.local_frame}`);
  if (!resolved) return null;
  return `${row.system}|${resolved.source_trajectory}|${resolved.xtc_frame_index}`;
}

function selectRepresentatives(frames, topK) {
  if (!frames.length) return [];

  const vectors = frames.map((frame) => frame.vector);
  const center = centroid(vectors);

  return frames
    .map((frame) => ({
      ...frame,
      representative_score: euclideanDistance(frame.vector, center),
    }))
    .sort(
      (a, b) =>
        a.representative_score - b.representative_score ||
        a.system.localeCompare(b.system) ||
        a.trajectory_name.localeCompare(b.trajectory_name) ||
        Number(a.local_frame) - Number(b.local_frame)
    )
    .slice(0, Math.min(topK, frames.length))
    .map((frame, index) => ({
      system: frame.system,
      model: frame.model,
      trajectory_type: frame.trajectory_type,
      state: frame.state,
      trajectory_name: frame.trajectory_name,
      local_frame: frame.local_frame,
      xtc_frame_index: frame.xtc_frame_index,
      representative_rank: index + 1,
      representative_score: Number(frame.representative_score.toFixed(6)),
    }));
}

export async function buildRepresentativeFrames({
  frameIndexPath = FRAME_INDEX_PATH,
  structuralPath = STRUCTURAL_PATH,
  outputPath = path.join(OUTPUT_DIR, 'representative_frames.csv'),
  topK = DEFAULT_TOP_K,
} = {}) {
  const structuralMap = await loadStructuralMap(structuralPath);
  const concatLookups = buildAllConcatLookups();
  const groups = new Map();

  let scanned = 0;
  let matched = 0;

  const stream = fs.createReadStream(frameIndexPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }

    scanned += 1;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((col, i) => [col, values[i]]));

    const structuralKey = resolveStructuralKey(row, concatLookups);
    if (!structuralKey) continue;

    const structural = structuralMap.get(structuralKey);
    if (!structural) continue;

    matched += 1;
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);

    groups.get(groupKey).push({
      system: row.system,
      model: row.model,
      trajectory_type: row.trajectory_type,
      state: Number.parseInt(row.state, 10),
      trajectory_name: row.trajectory_name,
      local_frame: row.local_frame,
      xtc_frame_index: row.xtc_frame_index,
      vector: featureVector(structural),
    });
  }

  const outputRows = [];
  for (const frames of groups.values()) {
    outputRows.push(...selectRepresentatives(frames, topK));
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
    groupCount: groups.size,
    rowCount: outputRows.length,
    outputPath,
  };
}
