import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SYSTEMS } from '../config/dataFiles.js';
import { OUTPUT_DIR } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'signature_residual_system.py');
const FRAME_INDEX_PATH = path.join(OUTPUT_DIR, 'frame_index.csv');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'state_signature_residuals.json');

function namesFileFor(systemId) {
  const local = path.join(OUTPUT_DIR, '..', systemId, `${systemId}_names.txt`);
  const alt = path.join(PROJECT_ROOT, 'public', 'data', systemId, `${systemId}_names.txt`);
  return fs.existsSync(local) ? local : alt;
}

function runResidualSystem(systemId, namesFile, frameIndexPath, outputPath) {
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
        `signature_residual_system failed for ${systemId}`
    );
  }

  return result.stderr?.trim() || '';
}

export function buildSignatureResiduals({
  systems = Object.keys(SYSTEMS),
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

    const tempOutput = path.join(OUTPUT_DIR, `state_signature_residuals.${systemId}.json`);
    tempFiles.push(tempOutput);
    const message = runResidualSystem(systemId, namesFile, frameIndexPath, tempOutput);
    if (message) process.stdout.write(`${message}\n`);

    const partial = JSON.parse(fs.readFileSync(tempOutput, 'utf8'));
    if (partial._meta) merged._meta = partial._meta;
    for (const [key, value] of Object.entries(partial)) {
      if (key === '_meta') continue;
      merged[key] = value;
    }
  }

  if (!merged._meta) {
    merged._meta = {
      format: 'distance_histogram_v2',
      bin_width: 0.1,
      max_distance: 40,
      n_bins: 400,
    };
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(merged)}\n`, 'utf8');

  for (const filePath of tempFiles) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  return { outputPath, groupCount: Object.keys(merged).filter((k) => k !== '_meta').length };
}
