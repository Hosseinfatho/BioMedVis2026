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

export const STATE_SUMMARY_COLUMNS = [
  'system',
  'model',
  'trajectory_type',
  'state',
  'frame_count',
  'avg_rmsd',
  'std_rmsd',
  'min_rmsd',
  'max_rmsd',
  'avg_radius_of_gyration',
  'avg_distance_1_42',
];

export const RMSD_BY_STATE_COLUMNS = [
  'system',
  'model',
  'trajectory_type',
  'state',
  'bin_start',
  'bin_end',
  'count',
  'fraction',
];

export const LIGAND_CONTACTS_COLUMNS = [
  'system',
  'model',
  'trajectory_type',
  'state',
  'resid',
  'contact_frequency',
  'avg_min_distance',
];

const RMSD_BIN_WIDTH = 0.5;
const RMSD_MAX = 15;
const RMSD_BINS = Math.ceil(RMSD_MAX / RMSD_BIN_WIDTH);

function pairKey(a, b) {
  return a <= b ? `${a}-${b}` : `${b}-${a}`;
}

function createGroup() {
  return {
    frameCount: 0,
    rmsdCount: 0,
    rmsdMean: 0,
    rmsdM2: 0,
    rmsdMin: Infinity,
    rmsdMax: -Infinity,
    rmsdBins: new Array(RMSD_BINS).fill(0),
    rgSum: 0,
    endToEndSum: 0,
    endToEndCount: 0,
    contactCounts: new Map(),
    contactDistSum: new Map(),
    ligandCounts: new Map(),
    ligandDistSum: new Map(),
  };
}

function updateRmsdStats(group, rmsd) {
  group.rmsdCount += 1;
  const delta = rmsd - group.rmsdMean;
  group.rmsdMean += delta / group.rmsdCount;
  group.rmsdM2 += delta * (rmsd - group.rmsdMean);
  group.rmsdMin = Math.min(group.rmsdMin, rmsd);
  group.rmsdMax = Math.max(group.rmsdMax, rmsd);

  const bin = Math.min(
    RMSD_BINS - 1,
    Math.max(0, Math.floor(rmsd / RMSD_BIN_WIDTH))
  );
  group.rmsdBins[bin] += 1;
}

function addPairDistance(group, key, distance) {
  group.contactDistSum.set(key, (group.contactDistSum.get(key) || 0) + distance);
  group.contactCounts.set(key, (group.contactCounts.get(key) || 0) + 1);
}

function addContact(group, i, j, distance) {
  const key = pairKey(i, j);
  addPairDistance(group, key, distance);
  // `contacts` list is already thresholded in Step 3.
  // Do NOT re-apply a fixed cutoff here.
  group.contactCounts.set(`contact:${key}`, (group.contactCounts.get(`contact:${key}`) || 0) + 1);
}

function accumulateStructural(group, structural) {
  group.frameCount += 1;
  updateRmsdStats(group, structural.rmsd);
  group.rgSum += structural.radius_of_gyration;

  const contacts = structural.contact_features;
  if (contacts?.key_distances?.['1-42'] != null) {
    group.endToEndSum += contacts.key_distances['1-42'];
    group.endToEndCount += 1;
  }

  for (const [key, distance] of Object.entries(contacts?.key_distances || {})) {
    addPairDistance(group, key, distance);
  }

  for (const [i, j, distance] of contacts?.contacts || []) {
    addContact(group, i, j, distance);
  }

  for (const entry of structural.ligand_contact_features?.contacts || []) {
    const resid = entry.resid;
    group.ligandCounts.set(resid, (group.ligandCounts.get(resid) || 0) + 1);
    group.ligandDistSum.set(
      resid,
      (group.ligandDistSum.get(resid) || 0) + entry.d
    );
  }
}

function groupMetaFromKey(groupKey) {
  const [system, model, trajectory_type, state] = groupKey.split('|');
  return { system, model, trajectory_type, state: Number.parseInt(state, 10) };
}

function finalizeGroups(groups) {
  const summaries = [];
  const rmsdRows = [];
  const ligandRows = [];
  const contactMaps = {};

  for (const [groupKey, group] of groups) {
    if (!group.frameCount) continue;

    const meta = groupMetaFromKey(groupKey);
    const stdRmsd =
      group.rmsdCount > 1
        ? Math.sqrt(group.rmsdM2 / (group.rmsdCount - 1))
        : 0;

    summaries.push({
      system: meta.system,
      model: meta.model,
      trajectory_type: meta.trajectory_type,
      state: meta.state,
      frame_count: group.frameCount,
      avg_rmsd: round(group.rmsdMean, 4),
      std_rmsd: round(stdRmsd, 4),
      min_rmsd: round(group.rmsdMin, 4),
      max_rmsd: round(group.rmsdMax, 4),
      avg_radius_of_gyration: round(group.rgSum / group.frameCount, 4),
      avg_distance_1_42:
        group.endToEndCount > 0
          ? round(group.endToEndSum / group.endToEndCount, 4)
          : '',
    });

    for (let bin = 0; bin < RMSD_BINS; bin++) {
      const count = group.rmsdBins[bin];
      if (!count) continue;
      rmsdRows.push({
        system: meta.system,
        model: meta.model,
        trajectory_type: meta.trajectory_type,
        state: meta.state,
        bin_start: round(bin * RMSD_BIN_WIDTH, 2),
        bin_end: round((bin + 1) * RMSD_BIN_WIDTH, 2),
        count,
        fraction: round(count / group.rmsdCount, 6),
      });
    }

    const contacts = [];
    for (const [key, count] of group.contactCounts) {
      if (!key.startsWith('contact:')) continue;
      const pair = key.slice('contact:'.length);
      const distCount = group.contactCounts.get(pair) || 0;
      contacts.push({
        pair,
        contact_frequency: round(count / group.frameCount, 6),
        avg_distance:
          distCount > 0
            ? round((group.contactDistSum.get(pair) || 0) / distCount, 4)
            : null,
      });
    }
    contacts.sort((a, b) => b.contact_frequency - a.contact_frequency);

    const pairDistances = {};
    for (const [key, sum] of group.contactDistSum) {
      if (key.startsWith('contact:')) continue;
      const count = group.contactCounts.get(key) || 0;
      if (!count) continue;
      pairDistances[key] = {
        mean: round(sum / count, 4),
        count,
      };
    }

    contactMaps[groupKey] = {
      ...meta,
      frame_count: group.frameCount,
      contacts,
      pair_distances: pairDistances,
    };

    for (const [resid, count] of group.ligandCounts) {
      ligandRows.push({
        system: meta.system,
        model: meta.model,
        trajectory_type: meta.trajectory_type,
        state: meta.state,
        resid,
        contact_frequency: round(count / group.frameCount, 6),
        avg_min_distance: round(
          (group.ligandDistSum.get(resid) || 0) / count,
          4
        ),
      });
    }
  }

  summaries.sort(sortGroupRows);
  rmsdRows.sort((a, b) => sortGroupRows(a, b) || a.bin_start - b.bin_start);
  ligandRows.sort(
    (a, b) =>
      sortGroupRows(a, b) ||
      a.resid - b.resid ||
      b.contact_frequency - a.contact_frequency
  );

  return { summaries, rmsdRows, ligandRows, contactMaps };
}

function sortGroupRows(a, b) {
  return (
    a.system.localeCompare(b.system) ||
    a.model.localeCompare(b.model) ||
    a.trajectory_type.localeCompare(b.trajectory_type) ||
    a.state - b.state
  );
}

function round(value, digits) {
  return Number.parseFloat(Number(value).toFixed(digits));
}

export async function buildStateSummaries({
  frameIndexPath = FRAME_INDEX_PATH,
  structuralPath = STRUCTURAL_PATH,
  outputDir = OUTPUT_DIR,
} = {}) {
  process.stdout.write('Building structural index database… ');
  const { db } = await ensureStructuralIndexDb({ structuralPath });
  process.stdout.write('done\n');

  const readers = createStructuralReaders(db);
  const concatLookups = buildAllConcatLookups();
  const groups = new Map();

  let matched = 0;
  let scanned = 0;

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

    const parts = resolveStructuralParts(row, concatLookups);
    if (!parts) continue;

    const structural = readers.readFrame(
      parts.system,
      parts.trajectoryName,
      parts.xtcFrameIndex
    );
    if (!structural) continue;

    matched += 1;
    const groupKey = `${row.system}|${row.model}|${row.trajectory_type}|${row.state}`;
    if (!groups.has(groupKey)) groups.set(groupKey, createGroup());
    accumulateStructural(groups.get(groupKey), structural);
  }

  const { summaries, rmsdRows, ligandRows, contactMaps } = finalizeGroups(groups);

  fs.mkdirSync(outputDir, { recursive: true });

  writeCsv(
    path.join(outputDir, 'state_summary.csv'),
    STATE_SUMMARY_COLUMNS,
    summaries
  );
  writeCsv(path.join(outputDir, 'rmsd_by_state.csv'), RMSD_BY_STATE_COLUMNS, rmsdRows);
  writeCsv(
    path.join(outputDir, 'ligand_contacts.csv'),
    LIGAND_CONTACTS_COLUMNS,
    ligandRows
  );
  fs.writeFileSync(
    path.join(outputDir, 'state_contact_maps.json'),
    `${JSON.stringify(contactMaps, null, 2)}\n`,
    'utf8'
  );

  return {
    scanned,
    matched,
    summaryCount: summaries.length,
    outputDir,
  };
}

function writeCsv(outputPath, columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(rowToCsvLine(row, columns));
  }
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}
