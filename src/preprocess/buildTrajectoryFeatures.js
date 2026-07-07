import fs from 'node:fs';
import readline from 'node:readline';
import { MODELS } from '../config/dataFiles.js';
import { OUTPUT_DIR } from './paths.js';
import { rowToCsvLine } from './writeFrameIndexCsv.js';

const MAX_STATES = 4;
const FRAME_INDEX_PATH = `${OUTPUT_DIR}/frame_index.csv`;

export const TRAJECTORY_FEATURE_COLUMNS = buildTrajectoryFeatureColumns(MAX_STATES);

function buildTrajectoryFeatureColumns(maxStates) {
  const cols = ['trajectory_name', 'system', 'model', 'trajectory_type'];

  for (let s = 0; s < maxStates; s++) {
    cols.push(`state${s}_ratio`);
  }

  for (let from = 0; from < maxStates; from++) {
    for (let to = 0; to < maxStates; to++) {
      if (from !== to) cols.push(`trans_${from}_to_${to}`);
    }
  }

  for (let from = 0; from < maxStates; from++) {
    for (let to = 0; to < maxStates; to++) {
      if (from !== to) cols.push(`trans_${from}_to_${to}_count`);
    }
  }

  cols.push(
    'num_transitions',
    'dominant_state',
    'trajectory_length',
    'support'
  );

  return cols;
}

function numStatesForModel(modelId) {
  return MODELS[modelId]?.numStates ?? MAX_STATES;
}

function trajectoryKey(row) {
  return `${row.system}|${row.model}|${row.trajectory_type}|${row.trajectory_name}`;
}

function parseCsvLine(line) {
  return line.split(',');
}

function computeTrajectoryFeatures(states, numStates) {
  const stateCounts = new Array(MAX_STATES).fill(0);
  const transitionCounts = {};
  let numTransitions = 0;
  const total = states.length;

  for (let i = 0; i < total; i++) {
    const s = states[i];
    if (s >= 0 && s < numStates) stateCounts[s]++;

    if (i > 0) {
      const prev = states[i - 1];
      if (prev !== s && prev >= 0 && prev < numStates && s >= 0 && s < numStates) {
        const key = `${prev}->${s}`;
        transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        numTransitions++;
      }
    }
  }

  const stateRatios = new Array(MAX_STATES).fill(0);
  for (let s = 0; s < numStates; s++) {
    stateRatios[s] = total > 0 ? stateCounts[s] / total : 0;
  }

  let dominantState = 0;
  let maxRatio = -1;
  for (let s = 0; s < numStates; s++) {
    if (stateRatios[s] > maxRatio) {
      maxRatio = stateRatios[s];
      dominantState = s;
    }
  }

  const transitionRates = {};
  for (let from = 0; from < numStates; from++) {
    for (let to = 0; to < numStates; to++) {
      if (from === to) continue;
      const key = `${from}->${to}`;
      transitionRates[key] =
        numTransitions > 0 ? (transitionCounts[key] || 0) / numTransitions : 0;
    }
  }

  return {
    stateRatios,
    transitionRates,
    transitionCounts,
    numTransitions,
    dominantState,
    trajectoryLength: total,
  };
}

function featureRowFromTrajectory(meta, features) {
  const row = {
    trajectory_name: meta.trajectory_name,
    system: meta.system,
    model: meta.model,
    trajectory_type: meta.trajectory_type,
  };

  for (let s = 0; s < MAX_STATES; s++) {
    row[`state${s}_ratio`] = features.stateRatios[s];
  }

  for (let from = 0; from < MAX_STATES; from++) {
    for (let to = 0; to < MAX_STATES; to++) {
      if (from === to) continue;
      const key = `${from}->${to}`;
      row[`trans_${from}_to_${to}`] = features.transitionRates[key] ?? 0;
      row[`trans_${from}_to_${to}_count`] = features.transitionCounts[key] ?? 0;
    }
  }

  row.num_transitions = features.numTransitions;
  row.dominant_state = features.dominantState;
  row.trajectory_length = features.trajectoryLength;
  row.support = 0;

  return row;
}

function applySupport(rows) {
  const maxLenByGroup = new Map();

  for (const row of rows) {
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}`;
    const len = row.trajectory_length || 0;
    maxLenByGroup.set(groupKey, Math.max(maxLenByGroup.get(groupKey) || 0, len));
  }

  for (const row of rows) {
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}`;
    const maxLen = maxLenByGroup.get(groupKey) || 0;
    row.support =
      maxLen > 0 ? row.trajectory_length / maxLen : 0;
  }
}

export async function buildTrajectoryFeaturesFromFrameIndex(
  frameIndexPath = FRAME_INDEX_PATH
) {
  if (!fs.existsSync(frameIndexPath)) {
    throw new Error(`Missing ${frameIndexPath}. Run preprocess:frame-index first.`);
  }

  const stream = fs.createReadStream(frameIndexPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header = null;
  let currentKey = null;
  let currentMeta = null;
  let currentStates = [];
  const featureRows = [];

  const flush = () => {
    if (!currentMeta || !currentStates.length) return;
    const numStates = numStatesForModel(currentMeta.model);
    const features = computeTrajectoryFeatures(currentStates, numStates);
    featureRows.push(featureRowFromTrajectory(currentMeta, features));
  };

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!header) {
      header = parseCsvLine(line);
      continue;
    }

    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((col, i) => [col, values[i]]));

    const key = trajectoryKey(row);
    if (currentKey !== key) {
      flush();
      currentKey = key;
      currentMeta = {
        trajectory_name: row.trajectory_name,
        system: row.system,
        model: row.model,
        trajectory_type: row.trajectory_type,
      };
      currentStates = [];
    }

    currentStates.push(Number.parseInt(row.state, 10));
  }

  flush();
  applySupport(featureRows);

  return featureRows;
}

export function writeTrajectoryFeaturesCsv(
  rows,
  outputPath,
  columns = TRAJECTORY_FEATURE_COLUMNS
) {
  fs.mkdirSync(`${OUTPUT_DIR}`, { recursive: true });
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(rowToCsvLine(row, columns));
  }
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  return rows.length;
}
