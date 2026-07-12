# GitHub Pages setup

**Live URL:** https://hosseinfatho.github.io/BioMedVis2026/

## One-time GitHub settings

1. Open **https://github.com/Hosseinfatho/BioMedVis2026/settings/pages**
2. **Build and deployment → Source:** **`GitHub Actions`** (recommended)
3. After push to `gitpage`, open **Actions** → **Deploy GitHub Pages** → wait for green check
4. Wait 1–3 minutes, then reload the live URL

### Alternative (branch deploy)

If you prefer **Deploy from a branch** instead of GitHub Actions:

- Branch: **`gh-pages`**
- Folder: **`/ (root)`**

The workflow also works with branch deploy if you switch the last step back to JamesIves; the current workflow uses official **GitHub Actions** deploy.

## If you still see 404

| Cause | Fix |
|---|---|
| Repo is **private** | GitHub Free only publishes **public** repos. Make the repo public, or use GitHub Pro. |
| Pages source not set | Use **`GitHub Actions`** (see above), not `main` or `gitpage`. |
| Workflow failed on **Prepare static topology** | Fixed: PDB files already in `public/trajectories/` are accepted. |
| Workflow failed / never ran | **Actions** tab → **Deploy GitHub Pages** → read error log → **Re-run workflow**. |
| First deploy pending | Push to `gitpage` or run workflow manually. |

## 3D trajectory playback (Viewer3D)

GitHub Pages is **static**, so the `/api/trajectory-frame` endpoint (Python + XTC)
is not available. By default Viewer3D shows the static PDB structure only.

Full per-frame playback would require the multi-GB XTC trajectories (~28 GB) or a
live backend, so it is **not** bundled into the static site. Two ways to enable it:

- **Run locally:** `npm run dev` serves the frame API from `vite.config.js`.
- **Host the frame API separately** (e.g. Render/Fly/VM running
  `scripts/xtc_frame_coords.py` behind `/api/trajectory-frame`), then build with:

  ```bash
  VITE_FRAME_API_BASE=https://your-api-host npm run build:pages
  ```

  Viewer3D calls that host for frames and falls back to the static structure if
  it is unreachable.

## How deploy works

- Push to branch **`gitpage`** → GitHub Actions builds `dist-pages/` → deploys via **GitHub Actions Pages**
- Only ~50 MB UI data is in git (see `.gitignore`); no XTC trajectories.

## Local test (same base path as production)

```bash
npm run prepare:pages-data
npm run build:pages
npm run preview -- --base /BioMedVis2026/
# open http://localhost:4173/BioMedVis2026/
```

PowerShell:

```powershell
npm run prepare:pages-data
npm run build:pages
npm run preview -- --base /BioMedVis2026/
```
