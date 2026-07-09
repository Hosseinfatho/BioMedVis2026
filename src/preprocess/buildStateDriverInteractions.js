import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SYSTEMS } from '../config/dataFiles.js';
import { OUTPUT_DIR } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'state_driver_system.py');
const FRAME_INDEX_PATH = path.join(OUTPUT_DIR, 'frame_index.csv');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'state_driver_interactions.json');

const STATE_DRIVER_SYSTEMS = Object.keys(SYSTEMS);

function namesFileFor(systemId) {
  const local = path.join(OUTPUT_DIR, '..', systemId, `${systemId}_names.txt`);
  const alt = path.join(PROJECT_ROOT, 'public', 'data', systemId, `${systemId}_names.txt`);
  return fs.existsSync(local) ? local : alt;
}

function runStateDriverSystem(systemId, namesFile, frameIndexPath, outputPath) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const result = spawnSync(
    py,
    [
      SCRIPT_PATH,
      systemId,
      '--names-file',
      namesFile,
      '--frame-index',
      frameIndexPath,
      '--output',
      outputPath,
    ],
    {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        `state_driver_system failed for ${systemId}`
    );
  }

  return result.stderr?.trim() || '';
}

export function buildStateDriverInteractions({
  systems = STATE_DRIVER_SYSTEMS,
  frameIndexPath = FRAME_INDEX_PATH,
  outputPath = OUTPUT_FILE,
} = {}) {
  if (!fs.existsSync(frameIndexPath)) {
    throw new Error(`Missing ${frameIndexPath}. Run preprocess:frame-index first.`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const merged = { _meta: null };
  const tempFiles = [];

  for (const systemId of systems) {
    const namesFile = namesFileFor(systemId);
    if (!fs.existsSync(namesFile)) {
      throw new Error(`Missing names file for ${systemId}`);
    }

    const tempOutput = path.join(OUTPUT_DIR, `state_driver_interactions.${systemId}.json`);
    tempFiles.push(tempOutput);
    const message = runStateDriverSystem(systemId, namesFile, frameIndexPath, tempOutput);
    if (message) process.stdout.write(`${message}\n`);

    const partial = JSON.parse(fs.readFileSync(tempOutput, 'utf8'));
    if (partial._meta) merged._meta = partial._meta;
    for (const [key, value] of Object.entries(partial)) {
      if (key === '_meta') continue;
      merged[key] = value;
    }
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(merged)}\n`, 'utf8');
  for (const temp of tempFiles) {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }

  const groupCount = Object.keys(merged).filter((k) => k !== '_meta').length;
  return { outputPath, groupCount };
}
