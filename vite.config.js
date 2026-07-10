import { spawn } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPagesBuild = process.env.VITE_PAGES_BUILD === '1';

const PAGES_PUBLIC_FILES = [
  'favicon.svg',
  'icons.svg',
  '.nojekyll',
  path.join('data', 'zsab2'),
  path.join('data', 'zsab3'),
  path.join('data', 'zsab4'),
  path.join('data', 'Residual', 'state_signature_residuals.json'),
  path.join('data', 'Residual', 'state_driver_interactions.json'),
  path.join('data', 'Residual', 'state_trajectory_frame_counts.json'),
  path.join('data', 'Residual', 'representative_frames.csv'),
  path.join('data', 'Residual', 'state_summary.csv'),
  path.join('data', 'Residual', 'rmsd_by_state.csv'),
  path.join('data', 'Residual', 'ligand_contacts.csv'),
  path.join('data', 'Residual', 'state_contact_maps.json'),
  path.join('trajectories', 'ZS-ab2', 'filtered.pdb'),
  path.join('trajectories', 'ZS-ab3', 'filtered.pdb'),
  path.join('trajectories', 'ZS-ab4', 'filtered.pdb'),
];

function copyPagesPublicAssets(publicDir, outDir) {
  for (const rel of PAGES_PUBLIC_FILES) {
    const normalized = rel.split(path.sep).join('/');
    const src = path.join(publicDir, rel);
    const dest = path.join(outDir, rel);

    if (!fs.existsSync(src)) {
      console.warn(`[pages-public-copy] missing: ${normalized}`);
      continue;
    }

    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, {
        recursive: true,
        filter: (srcPath) => {
          const relPath = path.relative(src, srcPath).split(path.sep).join('/');
          return relPath === '' || relPath.endsWith('.txt');
        },
      });
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function pagesPublicCopy() {
  let resolvedConfig;
  return {
    name: 'pages-public-copy',
    configResolved(config) {
      resolvedConfig = config;
    },
    closeBundle() {
      if (!isPagesBuild || !resolvedConfig) return;
      const publicDir = resolvedConfig.publicDir;
      const outDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      if (!publicDir || !fs.existsSync(publicDir)) return;
      copyPagesPublicAssets(publicDir, outDir);
    },
  };
}

function serveTrajectories() {
  return {
    name: 'serve-trajectories',
    configureServer(server) {
      const root = path.resolve(__dirname, 'trajectories');
      server.middlewares.use('/trajectories', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url || '').split('?')[0]);
        const filePath = path.normalize(path.join(root, urlPath));
        if (!filePath.startsWith(root)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const types = {
          '.pdb': 'chemical/x-pdb',
          '.xtc': 'application/octet-stream',
        };
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

function trajectoryFrameApi() {
  return {
    name: 'trajectory-frame-api',
    configureServer(server) {
      server.middlewares.use('/api/trajectory-frame', (req, res) => {
        const url = new URL(req.url || '', 'http://localhost');
        const system = url.searchParams.get('system');
        const trajectory = url.searchParams.get('trajectory');
        const frame = url.searchParams.get('frame');

        if (!system || !trajectory || frame == null) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'missing query params' }));
          return;
        }

        const script = path.join(__dirname, 'scripts', 'xtc_frame_coords.py');
        const py = process.platform === 'win32' ? 'python' : 'python3';
        const child = spawn(py, [script, system, trajectory, frame], {
          cwd: __dirname,
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        child.on('close', (code) => {
          res.setHeader('Content-Type', 'application/json');
          if (code !== 0) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: stderr.trim() || `xtc_frame_coords exited with ${code}`,
              })
            );
            return;
          }
          res.end(stdout.trim());
        });
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    copyPublicDir: !isPagesBuild,
    outDir: isPagesBuild ? 'dist-pages' : 'dist',
  },
  plugins: [pagesPublicCopy(), react(), serveTrajectories(), trajectoryFrameApi()],
});
