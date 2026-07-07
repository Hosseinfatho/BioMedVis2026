import { spawn } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  plugins: [react(), serveTrajectories(), trajectoryFrameApi()],
});
