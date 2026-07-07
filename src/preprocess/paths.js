import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const DATA_ROOT = path.join(PROJECT_ROOT, 'public', 'data');
export const OUTPUT_DIR = path.join(DATA_ROOT, 'Residual');

export function systemDataDir(systemId) {
  return path.join(DATA_ROOT, systemId);
}

export function systemDataFile(systemId, fileName) {
  return path.join(systemDataDir(systemId), fileName);
}
