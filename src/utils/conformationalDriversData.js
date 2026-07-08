import { AB42_RESIDUE_COUNT } from '../components/Analysis3D/Viewer3D/residueSpectrum';
import { MODELS } from '../config/dataFiles';
import { parseCsv } from './parseCsv';

export const RESIDUAL_DATA_BASE = '/data/Residual/';

export function contactMapKey(system, model, trajectoryType, state) {
  return `${system}|${model}|${trajectoryType}|${state}`;
}

let contactMapsPromise = null;
let stateSummaryPromise = null;
let rmsdByStatePromise = null;
let representativeFramesPromise = null;

export function loadContactMaps() {
  if (!contactMapsPromise) {
    contactMapsPromise = fetch(`${RESIDUAL_DATA_BASE}state_contact_maps.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load contact maps (${res.status})`);
        return res.json();
      })
      .catch((err) => {
        contactMapsPromise = null;
        throw err;
      });
  }
  return contactMapsPromise;
}

export function loadStateSummaryRows() {
  if (!stateSummaryPromise) {
    stateSummaryPromise = fetch(`${RESIDUAL_DATA_BASE}state_summary.csv`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load state summary (${res.status})`);
        return res.text();
      })
      .then(parseCsv)
      .catch((err) => {
        stateSummaryPromise = null;
        throw err;
      });
  }
  return stateSummaryPromise;
}

export function loadRmsdByStateRows() {
  if (!rmsdByStatePromise) {
    rmsdByStatePromise = fetch(`${RESIDUAL_DATA_BASE}rmsd_by_state.csv`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load RMSD bins (${res.status})`);
        return res.text();
      })
      .then(parseCsv)
      .catch((err) => {
        rmsdByStatePromise = null;
        throw err;
      });
  }
  return rmsdByStatePromise;
}

export function loadRepresentativeFrameRows() {
  if (!representativeFramesPromise) {
    representativeFramesPromise = fetch(`${RESIDUAL_DATA_BASE}representative_frames.csv`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load representative frames (${res.status})`);
        return res.text();
      })
      .then(parseCsv)
      .catch((err) => {
        representativeFramesPromise = null;
        throw err;
      });
  }
  return representativeFramesPromise;
}

function parsePair(pairStr) {
  const [a, b] = pairStr.split('-').map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { i: a, j: b };
}

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

export function buildOverallContactFrequencies(contactMaps, system, model, trajectoryType) {
  const totals = new Map();
  let stateCount = 0;

  for (const [key, entry] of Object.entries(contactMaps)) {
    const [sys, mdl, trajType] = key.split('|');
    if (sys !== system || mdl !== model || trajType !== trajectoryType) continue;
    stateCount += 1;
    for (const contact of entry.contacts || []) {
      totals.set(
        contact.pair,
        (totals.get(contact.pair) || 0) + contact.contact_frequency
      );
    }
  }

  const overall = new Map();
  if (!stateCount) return overall;

  for (const [pair, sum] of totals) {
    overall.set(pair, sum / stateCount);
  }
  return overall;
}

export function buildResidualContactMatrix(contactMaps, system, model, trajectoryType, state) {
  const key = contactMapKey(system, model, trajectoryType, state);
  const entry = contactMaps[key];
  const matrix = emptyMatrix();
  const overall = buildOverallContactFrequencies(
    contactMaps,
    system,
    model,
    trajectoryType
  );

  if (!entry) {
    return { matrix, topPairs: [], frameCount: 0 };
  }

  let maxAbs = 0;
  const pairs = [];

  for (const contact of entry.contacts || []) {
    const parsed = parsePair(contact.pair);
    if (!parsed) continue;
    const baseline = overall.get(contact.pair) ?? 0;
    const residual = contact.contact_frequency - baseline;
    setSymmetric(matrix, parsed.i, parsed.j, residual);
    maxAbs = Math.max(maxAbs, Math.abs(residual));
    pairs.push({
      i: parsed.i,
      j: parsed.j,
      residual,
      stateFrequency: contact.contact_frequency,
      overallFrequency: baseline,
    });
  }

  pairs.sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual));

  return {
    matrix,
    topPairs: pairs.slice(0, 8),
    frameCount: entry.frame_count ?? 0,
    maxAbs: maxAbs || 1,
  };
}

export function filterStateSummary(rows, system, model, trajectoryType, state) {
  return rows.find(
    (row) =>
      row.system === system &&
      row.model === model &&
      row.trajectory_type === trajectoryType &&
      Number.parseInt(row.state, 10) === state
  );
}

export function filterRmsdDistribution(rows, system, model, trajectoryType, state) {
  return rows
    .filter(
      (row) =>
        row.system === system &&
        row.model === model &&
        row.trajectory_type === trajectoryType &&
        Number.parseInt(row.state, 10) === state
    )
    .map((row) => ({
      binStart: Number.parseFloat(row.bin_start),
      binEnd: Number.parseFloat(row.bin_end),
      count: Number.parseInt(row.count, 10),
      fraction: Number.parseFloat(row.fraction),
    }))
    .sort((a, b) => a.binStart - b.binStart);
}

export function findRepresentativeFrame(rows, system, model, trajectoryType, state) {
  const match = rows.find(
    (row) =>
      row.system === system &&
      row.model === model &&
      row.trajectory_type === trajectoryType &&
      Number.parseInt(row.state, 10) === state &&
      Number.parseInt(row.representative_rank, 10) === 1
  );
  if (!match) return null;

  const frameIndex = Number.parseInt(match.local_frame, 10);
  return {
    systemId: match.system,
    trajectoryName: match.trajectory_name,
    frameIndex: Number.isFinite(frameIndex) ? frameIndex : 0,
    score: Number.parseFloat(match.representative_score),
    isConcatPath: match.trajectory_name.startsWith('concat_'),
  };
}

export function stateOptionsForModel(modelId) {
  const numStates = MODELS[modelId]?.numStates ?? 2;
  return Array.from({ length: numStates }, (_, state) => state);
}

export function residualColor(value, maxAbs) {
  const clamped = Math.max(-1, Math.min(1, value / maxAbs));
  const neutralBand = 0.06;
  if (Math.abs(clamped) < neutralBand) return '#ffffff';

  if (clamped > 0) {
    const t = (clamped - neutralBand) / (1 - neutralBand);
    const g = Math.round(255 * (1 - t * 0.85));
    const b = Math.round(255 * (1 - t * 0.9));
    return `rgb(255,${g},${b})`;
  }

  const t = (-clamped - neutralBand) / (1 - neutralBand);
  const r = Math.round(255 * (1 - t * 0.85));
  const g = Math.round(255 * (1 - t * 0.85));
  return `rgb(${r},${g},255)`;
}
