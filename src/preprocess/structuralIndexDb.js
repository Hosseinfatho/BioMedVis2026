import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { OUTPUT_DIR } from './paths.js';

const DEFAULT_DB_PATH = path.join(OUTPUT_DIR, 'structural_index.db');
const DEFAULT_STRUCTURAL_PATH = path.join(OUTPUT_DIR, 'frame_structural_features.csv');

export function parseCsvLine(line) {
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

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS frames (
      system TEXT NOT NULL,
      trajectory_name TEXT NOT NULL,
      xtc_frame_index INTEGER NOT NULL,
      rmsd REAL NOT NULL,
      radius_of_gyration REAL NOT NULL,
      d_1_42 REAL,
      d_1_28 REAL,
      d_17_42 REAL,
      d_11_42 REAL,
      d_18_42 REAL,
      contacts_json TEXT NOT NULL DEFAULT '[]',
      ligand_json TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (system, trajectory_name, xtc_frame_index)
    );
  `);
}

function removeDbFiles(dbPath) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const filePath = `${dbPath}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function validateDb(db) {
  const columns = db.prepare(`PRAGMA table_info(frames)`).all();
  const hasContactsJson = columns.some((col) => col.name === 'contacts_json');
  if (!hasContactsJson) return false;

  const row = db.prepare(`SELECT COUNT(*) AS n FROM frames`).get();
  return (row?.n ?? 0) > 0;
}

function isDbReady(dbPath, structuralPath) {
  if (!fs.existsSync(dbPath) || !fs.existsSync(structuralPath)) return false;
  const dbTime = fs.statSync(dbPath).mtimeMs;
  const csvTime = fs.statSync(structuralPath).mtimeMs;
  if (dbTime < csvTime) return false;
  return fs.statSync(dbPath).size > 1024;
}

export async function ensureStructuralIndexDb({
  structuralPath = DEFAULT_STRUCTURAL_PATH,
  dbPath = DEFAULT_DB_PATH,
  force = false,
} = {}) {
  if (!fs.existsSync(structuralPath)) {
    throw new Error(`Missing ${structuralPath}. Run preprocess:frame-structural first.`);
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (!force && isDbReady(dbPath, structuralPath)) {
    process.stdout.write('(using cached db) ');
    return openStructuralIndexDb(dbPath);
  }

  if (fs.existsSync(dbPath)) removeDbFiles(dbPath);
  process.stdout.write('(rebuilding) ');

  const db = new DatabaseSync(dbPath);
  createSchema(db);

  const insertFrame = db.prepare(`
    INSERT INTO frames (
      system, trajectory_name, xtc_frame_index, rmsd, radius_of_gyration,
      d_1_42, d_1_28, d_17_42, d_11_42, d_18_42, contacts_json, ligand_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stream = fs.createReadStream(structuralPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header = null;
  let count = 0;

  db.exec('BEGIN');
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }

    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((col, i) => [col, values[i]]));
    const contacts = JSON.parse(row.contact_features);
    const ligand = JSON.parse(row.ligand_contact_features);
    const kd = contacts.key_distances || {};

    insertFrame.run(
      row.system,
      row.trajectory_name,
      Number.parseInt(row.xtc_frame_index, 10),
      Number.parseFloat(row.rmsd),
      Number.parseFloat(row.radius_of_gyration),
      kd['1-42'] ?? null,
      kd['1-28'] ?? null,
      kd['17-42'] ?? null,
      kd['11-42'] ?? null,
      kd['18-42'] ?? null,
      JSON.stringify(contacts.contacts || []),
      JSON.stringify(ligand.contacts || [])
    );

    count += 1;
    if (count % 10000 === 0) {
      process.stdout.write(`${count.toLocaleString()}… `);
    }
  }
  db.exec('COMMIT');
  db.exec('PRAGMA wal_checkpoint(FULL)');

  return { db, dbPath, frameCount: count };
}

export function openStructuralIndexDb(dbPath = DEFAULT_DB_PATH) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Missing ${dbPath}. Build it with ensureStructuralIndexDb().`);
  }
  const db = new DatabaseSync(dbPath, { open: true, enableLoadExtension: false });
  return { db, dbPath };
}

const SELECT_FRAME_FULL = `
  SELECT
    rmsd, radius_of_gyration, d_1_42, d_1_28, d_17_42, d_11_42, d_18_42,
    contacts_json, ligand_json
  FROM frames
  WHERE system = ? AND trajectory_name = ? AND xtc_frame_index = ?
`;

const SELECT_FRAME_LITE = `
  SELECT rmsd, radius_of_gyration, d_1_42, d_1_28, d_17_42, d_11_42, d_18_42
  FROM frames
  WHERE system = ? AND trajectory_name = ? AND xtc_frame_index = ?
`;

function queryFrame(db, sql, system, trajectoryName, xtcFrameIndex) {
  const frameIndex = Number.parseInt(xtcFrameIndex, 10);
  const stmt = db.prepare(sql);
  try {
    return stmt.get(system, trajectoryName, frameIndex);
  } finally {
    stmt.finalize?.();
  }
}

export function createStructuralReaders(db) {
  return {
    readFrame(system, trajectoryName, xtcFrameIndex) {
      const frame = queryFrame(
        db,
        SELECT_FRAME_FULL,
        system,
        trajectoryName,
        xtcFrameIndex
      );
      if (!frame) return null;

      const keyDistances = {};
      if (frame.d_1_42 != null) keyDistances['1-42'] = frame.d_1_42;
      if (frame.d_1_28 != null) keyDistances['1-28'] = frame.d_1_28;
      if (frame.d_17_42 != null) keyDistances['17-42'] = frame.d_17_42;
      if (frame.d_11_42 != null) keyDistances['11-42'] = frame.d_11_42;
      if (frame.d_18_42 != null) keyDistances['18-42'] = frame.d_18_42;

      const contactsJson = String(frame.contacts_json ?? '[]');
      const ligandJson = String(frame.ligand_json ?? '[]');

      return {
        rmsd: frame.rmsd,
        radius_of_gyration: frame.radius_of_gyration,
        contact_features: {
          key_distances: keyDistances,
          contacts: JSON.parse(contactsJson),
        },
        ligand_contact_features: {
          contacts: JSON.parse(ligandJson),
        },
      };
    },

    readFeatureVector(system, trajectoryName, xtcFrameIndex) {
      const frame = queryFrame(
        db,
        SELECT_FRAME_LITE,
        system,
        trajectoryName,
        xtcFrameIndex
      );
      if (!frame) return null;
      return [
        frame.rmsd,
        frame.radius_of_gyration,
        frame.d_1_42 ?? 0,
        frame.d_1_28 ?? 0,
        frame.d_17_42 ?? 0,
        frame.d_11_42 ?? 0,
        frame.d_18_42 ?? 0,
      ];
    },
  };
}

export function resolveStructuralParts(row, concatLookups) {
  if (row.trajectory_type === 'original') {
    return {
      system: row.system,
      trajectoryName: row.trajectory_name,
      xtcFrameIndex: row.xtc_frame_index,
    };
  }

  const lookup = concatLookups.get(row.system);
  const resolved = lookup?.get(`${row.trajectory_name}|${row.local_frame}`);
  if (!resolved) return null;

  return {
    system: row.system,
    trajectoryName: resolved.source_trajectory,
    xtcFrameIndex: resolved.xtc_frame_index,
  };
}

export function resolveStructuralKey(row, concatLookups) {
  const parts = resolveStructuralParts(row, concatLookups);
  if (!parts) return null;
  return `${parts.system}|${parts.trajectoryName}|${parts.xtcFrameIndex}`;
}
