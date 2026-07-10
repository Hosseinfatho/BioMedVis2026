# GitHub Pages setup

**Live URL:** https://hosseinfatho.github.io/BioMedVis2026/

## One-time GitHub settings

1. Open **https://github.com/Hosseinfatho/BioMedVis2026/settings/pages**
2. **Build and deployment → Source:** `Deploy from a branch`
3. **Branch:** `gh-pages` · folder **`/ (root)`** · Save
4. Wait 1–3 minutes after the workflow finishes

## If you still see 404

| Cause | Fix |
|---|---|
| Repo is **private** | GitHub Free only publishes **public** repos. Make the repo public, or use GitHub Pro. |
| Pages source not set | Use branch **`gh-pages`**, not `gitpage` or `main`. |
| Workflow failed on **Prepare static topology** | Fixed: PDB files already in `public/trajectories/` are accepted (no copy required). |
| **`gh-pages` branch missing** | Open **Actions** → re-run workflow after push, or deploy locally with `npm run build:pages` then `npx gh-pages -d dist-pages`. |
| First deploy pending | Push to `gitpage` or run workflow manually (**Actions → Run workflow**). |

## How deploy works

- Push to branch **`gitpage`** → GitHub Actions builds → pushes **`dist/`** to branch **`gh-pages`**
- Only ~50 MB UI data is in git (see `.gitignore`); no XTC trajectories.

## Local test (same base path as production)

```bash
npm run prepare:pages-data
$env:VITE_BASE_PATH="/BioMedVis2026/"; npm run build   # PowerShell
npm run preview
# open http://localhost:4173/BioMedVis2026/
```
