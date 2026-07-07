import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SYSTEMS } from '../config/dataFiles.js';
import { OUTPUT_DIR } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'structural_trajectory_features.py');
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

export function runStructuralTrajectory(systemId, trajectoryName, outputPath, writeHeader) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const args = [
    SCRIPT_PATH,
    systemId,
    trajectoryName,
    '--output',
    outputPath,
  ];
  if (writeHeader) args.push('--write-header');

  const result = spawnSync(py, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        `structural_trajectory_features failed for ${systemId}/${trajectoryName}`
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
    let names = readTrajectoryNames(systemId);
    if (limitPerSystem != null) {
      names = names.slice(0, limitPerSystem);
    }

    for (const trajectoryName of names) {
      const message = runStructuralTrajectory(
        systemId,
        trajectoryName,
        outputPath,
        !headerWritten
      );
      headerWritten = true;
      if (message) process.stdout.write(`${message}\n`);
      total += 1;
    }
  }

  return { outputPath, trajectoryCount: total };
}
