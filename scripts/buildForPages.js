#!/usr/bin/env node
/**
 * Production build for GitHub Pages (skips multi-GB XTC under public/data/trajectories).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const env = {
  ...process.env,
  VITE_PAGES_BUILD: '1',
  VITE_BASE_PATH: process.env.VITE_BASE_PATH || '/BioMedVis2026/',
};

const result = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
