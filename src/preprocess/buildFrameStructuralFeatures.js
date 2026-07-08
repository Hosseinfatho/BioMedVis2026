import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SYSTEMS } from '../config/dataFiles.js';
import { OUTPUT_DIR } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'structural_system_features.py');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'frame_structural_features.csv');

export const FRAME_STRUCTURAL_COLUMNS = [
  'system',
  'trajectory_name',
  'local_frame',
  'xtc_frame_index',
  'rmsd',
  'radius_of_gyration',
  'contact_features',
  'ligand_contact_features',
];

export function readTrajectoryNames(systemId) {
  const namesFile = path.join(OUTPUT_DIR, '..', systemId, `${systemId}_names.txt`);
  const altFile = path.join(PROJECT_ROOT, 'public', 'data', systemId, `${systemId}_names.txt`);

  const filePath = fs.existsSync(namesFile) ? namesFile : altFile;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing names file for ${systemId}`);
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function runStructuralSystem(systemId, namesFilePath, outputPath, writeHeader, limit) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const args = [
    SCRIPT_PATH,
    systemId,
    '--names-file',
    namesFilePath,
    '--output',
    outputPath,
  ];
  if (writeHeader) args.push('--write-header');
  if (limit != null) args.push('--limit', String(limit));

  const result = spawnSync(py, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        `structural_system_features failed for ${systemId}`
    );
  }

  return result.stderr?.trim() || '';
}

export function buildFrameStructuralFeatures({
  systems = Object.keys(SYSTEMS),
  outputPath = OUTPUT_FILE,
  limitPerSystem = null,
} = {}) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  let headerWritten = false;
  let total = 0;

  for (const systemId of systems) {
    const namesFile = path.join(OUTPUT_DIR, '..', systemId, `${systemId}_names.txt`);
    const altFile = path.join(PROJECT_ROOT, 'public', 'data', systemId, `${systemId}_names.txt`);
    const namesFilePath = fs.existsSync(namesFile) ? namesFile : altFile;
    if (!fs.existsSync(namesFilePath)) {
      throw new Error(`Missing names file for ${systemId}`);
    }

    const message = runStructuralSystem(
      systemId,
      namesFilePath,
      outputPath,
      !headerWritten,
      limitPerSystem
    );
    headerWritten = true;
    if (message) process.stdout.write(`${message}\n`);
    total += 1;
  }

  return { outputPath, trajectoryCount: total };
}
