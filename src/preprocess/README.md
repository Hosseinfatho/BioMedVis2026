# Preprocessing pipeline

Code: `src/preprocess/`  
Output: `public/data/Residual/`

## Requirements

- Node.js 18+
- Python 3 + **numpy** + **MDAnalysis** (Step 3 only)

Install Python deps **in the same terminal/env where you run npm**:

```bash
pip install -r scripts/requirements.txt
```

Verify:

```bash
python -c "import numpy, MDAnalysis; print('OK')"
```

If that fails, npm’s Step 3 will fail too — `(base)` conda may use a different Python than you expect.
- Raw data:
  - `public/data/zsabX/` — `states*.txt`, `order.txt`, `concatenated.txt`
  - `trajectories/ZS-abX/` — `filtered.pdb`, `output.filtered.xtc`

## Run order

```bash
npm run preprocess:frame-index              # Step 1
npm run preprocess:trajectory-features    # Step 2
npm run preprocess:frame-structural       # Step 3 (slow, hours)
npm run preprocess:structural-index       # Step 3b (build SQLite cache, optional)
npm run preprocess:state-summaries          # Step 4
npm run preprocess:representative-frames    # Step 5
```

Step 3 options:

```bash
node src/preprocess/runFrameStructuralFeatures.js zsab2   # one system
PREPROCESS_LIMIT=2 npm run preprocess:frame-structural    # test run
```

Step 5 options:

```bash
REPRESENTATIVE_TOP_K=10 npm run preprocess:representative-frames
```

---

## Steps summary

| Step | Command | Input | Output | Used for |
|---|---|---|---|---|
| **1** | `preprocess:frame-index` | `states*.txt`, `order.txt`, `concatenated.txt` | `frame_index.csv` | T1, T2, T3, 3D linking |
| **2** | `preprocess:trajectory-features` | `frame_index.csv` | `trajectory_features.csv` | T1 fingerprint matrix, T2 clustering |
| **3** | `preprocess:frame-structural` | `filtered.pdb`, `output.filtered.xtc` | `frame_structural_features.csv` | T3 RMSD, contacts, ligand |
| **4** | `preprocess:state-summaries` | `frame_index.csv` + `frame_structural_features.csv` | `state_summary.csv`, `rmsd_by_state.csv`, `state_contact_maps.json`, `ligand_contacts.csv`, `structural_index.db` | T3 state explanation |
| **5** | `preprocess:representative-frames` | `frame_index.csv` + `frame_structural_features.csv` (+ db cache) | `representative_frames.csv` | T3 representative 3D frames |

---

## Step details

### Step 1 — `frame_index.csv`
Connects abstract Markov states to physical frames.

**Input:** all systems (zsab2/3/4), all models (states2/3/4), original + concatenated  
**Output columns:** `system`, `model`, `trajectory_type`, `trajectory_name`, `epoch`, `local_frame`, `state`, `xtc_frame_index`, `global_order`

### Step 2 — `trajectory_features.csv`
One row per trajectory — state ratios, transition rates/counts, support.

**Input:** `frame_index.csv`  
**Output columns:** `trajectory_name`, `system`, `model`, `trajectory_type`, `state0_ratio`…, `trans_A_to_B`, `num_transitions`, `dominant_state`, `trajectory_length`, `support`

### Step 3 — `frame_structural_features.csv`
One row per frame — structural metrics (calculated **once per system**, not per state model).

**Input:** `filtered.pdb` + `output.filtered.xtc`  
**Output columns:** `system`, `trajectory_name`, `local_frame`, `xtc_frame_index`, `rmsd`, `radius_of_gyration`, `contact_features`, `ligand_contact_features`  
**Script:** `scripts/structural_trajectory_features.py`

### Step 4 — State summaries
Joins state labels + structural features per Markov state.

**Input:** `frame_index.csv` + `frame_structural_features.csv`  
**Outputs:**
- `state_summary.csv` — avg RMSD, Rg, distance 1–42
- `rmsd_by_state.csv` — RMSD histogram bins
- `state_contact_maps.json` — residue contact frequency
- `ligand_contacts.csv` — TMP/SPA contacts per state

### Step 5 — `representative_frames.csv`
Top frames closest to structural center of each state (default: 5 per state).

**Input:** `frame_index.csv` + `frame_structural_features.csv`  
**Output columns:** `system`, `model`, `trajectory_type`, `state`, `trajectory_name`, `local_frame`, `xtc_frame_index`, `representative_rank`, `representative_score`

---

## File map

```
src/preprocess/
  runFrameIndex.js              → Step 1
  runTrajectoryFeatures.js      → Step 2
  runFrameStructuralFeatures.js → Step 3
  runStateSummaries.js          → Step 4
  runRepresentativeFrames.js    → Step 5

public/data/Residual/
  frame_index.csv
  trajectory_features.csv
  frame_structural_features.csv
  state_summary.csv
  rmsd_by_state.csv
  state_contact_maps.json
  ligand_contacts.csv
  representative_frames.csv
```

Each output has a matching `.md` file in the same folder with more detail.
