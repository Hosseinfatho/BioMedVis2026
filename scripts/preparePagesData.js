#!/usr/bin/env node
/**
 * Copy filtered.pdb topology files into public/trajectories/ for static hosting
 * (GitHub Pages serves public/ at site root → /trajectories/ZS-abX/filtered.pdb).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SYSTEMS = [
  { id: 'zsab2', folder: 'ZS-ab2' },
  { id: 'zsab3', folder: 'ZS-ab3' },
  { id: 'zsab4', folder: 'ZS-ab4' },
];

const SOURCE_ROOTS = [
  path.join(root, 'public', 'trajectories'),
  path.join(root, 'public', 'data', 'trajectories'),
  path.join(root, 'trajectories'),
  path.join(root, 'covampnet_data', 'CoVAMPnet_data', 'trajectories'),
];

function findPdb(folder) {
  for (const base of SOURCE_ROOTS) {
    const candidate = path.join(base, folder, 'filtered.pdb');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let ready = 0;
for (const { folder } of SYSTEMS) {
  const destDir = path.join(root, 'public', 'trajectories', folder);
  const dest = path.join(destDir, 'filtered.pdb');

  if (fs.existsSync(dest)) {
    console.log(`Already present: ${dest}`);
    ready += 1;
    continue;
  }

  const src = findPdb(folder);
  if (!src) {
    console.warn(`Warning: filtered.pdb not found for ${folder}`);
    continue;
  }

  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} → ${dest}`);
  ready += 1;
}

if (ready === 0) {
  console.error('No PDB files available. Place filtered.pdb under public/trajectories/ or trajectories/.');
  process.exit(1);
}

console.log(`Done (${ready} PDB file(s) ready).`);
