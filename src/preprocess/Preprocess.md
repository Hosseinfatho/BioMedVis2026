# Preprocessing pipeline

> **Master doc:** [`../../explain.md`](../../explain.md) §2 (raw data) · §4 (preprocess summary) · §5 (task → component map)  
> **Raw data inventory:** [`../../data.md`](../../data.md)

**Code:** `src/preprocess/`  
**Python helpers:** `scripts/*.py`  
**Runtime output:** `public/data/Residual/`

This document lists **all input data**, **every preprocess step implemented in code**, and **every output file** — what it contains, how it is built, why it exists, and which UI feature uses it.

---

## 1. Input data (what we have)

### 1.1 Three simulation systems

| ID | Label | Ligand | Raw MD folder | Dashboard text folder |
|---|---|---|---|---|
| `zsab2` | Free Aβ42 | none | `trajectories/ZS-ab2/` | `public/data/zsab2/` |
| `zsab3` | Aβ42 + TMP | tramiprosate | `trajectories/ZS-ab3/` | `public/data/zsab3/` |
| `zsab4` | Aβ42 + SPA | 3-sulfopropanoic acid | `trajectories/ZS-ab4/` | `public/data/zsab4/` |

Aβ42 has **42 residues**. Each system has one topology file and ~300 simulation folders.

### 1.2 CoVAMPnet raw trajectories (`trajectories/ZS-abX/`)

Used by **Steps 3, 6, 7** (MDAnalysis) and **Viewer3D** at runtime.

| File / folder | Contents | Role |
|---|---|---|
| `filtered.pdb` | Atom/residue topology (636 atoms) | Reference structure for RMSD, contacts, 3D viewer |
| `e1s1_0/output.filtered.xtc` | Coordinates per frame — fresh simulation | Structural metrics, 3D animation |
| `e10s12_e1s4p0f1673/...` | Chained simulation (continues from parent frame) | Same as above |
| `.output.filtered.xtc.numframes` | Frame count sidecar (optional) | Sanity checks |

**Folder naming:** `e{epoch}s{sim}[_e{parentEpoch}s{parentSim}p0f{frame}]` — fresh runs end in `_0`.

**Source:** [CoVAMPnet data release](https://data.ciirc.cvut.cz/public/projects/2023CoVAMPnet/) (~17 GB). Not committed to git; copy locally under `BioMedVis2026/trajectories/`.

### 1.3 Bio+MedVis challenge text files (`public/data/zsabX/`)

Loaded **directly by the dashboard** at runtime (no preprocess required for basic charts/matrices).

| File | Contents | Used by |
|---|---|---|
| `zsabX_names.txt` | All trajectory names (alphabetical) | Step 3 — maps names → XTC folders |
| `zsabX_order.txt` | `start_time: trajectory_name` — global timeline order | Component 1 timeline X-axis; Step 1 `global_order` |
| `zsabX_concatenated.txt` | Multi-segment glued paths (`length+`, segment ranges) | Concatenated view rows; Step 1 concat rows |
| `zsabX_states2.txt` | Per-frame MSM label (2 states) | Charts, Compare matrices, frame index |
| `zsabX_states3.txt` | Per-frame MSM label (3 states) | Default model in most views |
| `zsabX_states4.txt` | Per-frame MSM label (4 states) | Model selector |

**`states*.txt` line format:** `trajectory_name: 0,1,2,0,…` — one comma-separated state per frame.

**Source:** [Bio+MedVis Challenge 2026](https://gitlab.fi.muni.cz/visitlab/bio-medvis-challenge-2026/).

### 1.4 Data not used by current preprocess scripts

| Item | Note |
|---|---|
| `covampnet_data/models/` | VAMPnet weights — not read by ConformaLens preprocess |
| `model_outputs/` | MSM probabilities, Koopman matrices — not read |
| `zsab2_contacts.json` (if present) | Legacy/extra; dashboard uses `state_contact_maps.json` instead |

---

## 2. Preprocessing steps (code in `src/preprocess/`)

All steps write to `public/data/Residual/` unless noted.

### Requirements

- **Node.js 18+**
- **Python 3** + **numpy** + **MDAnalysis** (Steps 3, 6, 7)

```bash
cd BioMedVis2026
pip install -r scripts/requirements.txt
python -c "import numpy, MDAnalysis; print('OK')"
```

### Run order (dependency chain)

```bash
npm run preprocess:frame-index                    # Step 1 — required first
npm run preprocess:trajectory-features              # Step 2
npm run preprocess:frame-structural                 # Step 3 (slow, hours)
npm run preprocess:structural-index                 # Step 3b (optional standalone)
npm run preprocess:state-summaries                  # Step 4 (also builds db if missing)
npm run preprocess:representative-frames            # Step 5
npm run preprocess:state-trajectory-frame-counts    # Step 5b (needs Step 5 + db)
npm run preprocess:signature-residuals              # Step 6
npm run preprocess:state-driver-interactions        # Step 7
```

### Pipeline diagram

```
public/data/zsabX/  (states*, order, concatenated, names)
         │
         ▼  Step 1  buildFrameIndex.js
    frame_index.csv ─────────────────────────────────────────────┐
         │                                                        │
         ├── Step 2  buildTrajectoryFeatures.js                  │
         │       trajectory_features.csv (offline export)          │
         │                                                        │
trajectories/ZS-abX/  (filtered.pdb + *.xtc)                     │
         │                                                        │
         ▼  Step 3  buildFrameStructuralFeatures.js              │
         │       + scripts/structural_system_features.py         │
    frame_structural_features.csv                                 │
         │                                                        │
         ▼  Step 3b  structuralIndexDb.js                       │
    structural_index.db ◄── also built inside Steps 4–5b         │
         │                                                        │
         ├── Step 4  buildStateSummaries.js ◄── frame_index       │
         │       state_summary.csv, rmsd_by_state.csv,            │
         │       state_contact_maps.json, ligand_contacts.csv     │
         │                                                        │
         ├── Step 5  buildRepresentativeFrames.js ◄── frame_index │
         │       representative_frames.csv                       │
         │                                                        │
         ├── Step 5b buildStateTrajectoryFrameCounts.js           │
         │       state_trajectory_frame_counts.json               │
         │                                                        │
         ├── Step 6  buildSignatureResiduals.js ◄── frame_index   │
         │       + scripts/signature_residual_system.py           │
         │       state_signature_residuals.json                   │
         │                                                        │
         └── Step 7  buildStateDriverInteractions.js ◄── frame_index│
                 + scripts/state_driver_system.py                │
                 state_driver_interactions.json ◄─────────────────┘
```

### Step-by-step (builders and runners)

| Step | npm command | Builder | Runner | Main inputs |
|---|---|---|---|---|
| **1** | `preprocess:frame-index` | `buildFrameIndex.js` | `runFrameIndex.js` | `states2/3/4.txt`, `order.txt`, `concatenated.txt` per system |
| **2** | `preprocess:trajectory-features` | `buildTrajectoryFeatures.js` | `runTrajectoryFeatures.js` | `frame_index.csv` |
| **3** | `preprocess:frame-structural` | `buildFrameStructuralFeatures.js` | `runFrameStructuralFeatures.js` | `filtered.pdb`, `output.filtered.xtc`, `names.txt` |
| **3b** | `preprocess:structural-index` | `structuralIndexDb.js` | `runStructuralIndex.js` | `frame_structural_features.csv` |
| **4** | `preprocess:state-summaries` | `buildStateSummaries.js` | `runStateSummaries.js` | `frame_index.csv` + db lookup |
| **5** | `preprocess:representative-frames` | `buildRepresentativeFrames.js` | `runRepresentativeFrames.js` | `frame_index.csv` + db lookup |
| **5b** | `preprocess:state-trajectory-frame-counts` | `buildStateTrajectoryFrameCounts.js` | `runStateTrajectoryFrameCounts.js` | `frame_index.csv`, `representative_frames.csv`, db |
| **6** | `preprocess:signature-residuals` | `buildSignatureResiduals.js` | `runSignatureResiduals.js` | `frame_index.csv` + trajectories |
| **7** | `preprocess:state-driver-interactions` | `buildStateDriverInteractions.js` | `runStateDriverInteractions.js` | `frame_index.csv` + trajectories (all 3 systems) |

**Shared helpers (not standalone steps):**

| Module | Role |
|---|---|
| `paths.js` | `DATA_ROOT`, `OUTPUT_DIR`, per-system file paths |
| `buildConcatLookup.js` | Maps concatenated `local_frame` → source trajectory + `xtc_frame_index` (Steps 4, 5, 5b) |
| `writeFrameIndexCsv.js` | CSV writer utilities |
| `structuralIndexDb.js` | SQLite cache; parses `contact_features` / `ligand_contact_features` JSON from Step 3 |

### Step options

```bash
# Step 3 — one system or test limit
node src/preprocess/runFrameStructuralFeatures.js zsab2
PREPROCESS_LIMIT=2 npm run preprocess:frame-structural

# Step 5 — more representatives per state
REPRESENTATIVE_TOP_K=10 npm run preprocess:representative-frames

# Step 5b — green-bar threshold (default P10 = closest 10% to centroid)
THRESHOLD_PERCENTILE=10 npm run preprocess:state-trajectory-frame-counts
```

### Methods (short)

**Step 1 — frame index**  
For every frame in every trajectory, under every MSM model (`states2/3/4`) and view mode (`original` / `concatenated`), emit one row linking: trajectory name, local frame index, Markov state, XTC frame index, and global timeline position (`global_order` from `order.txt`).

**Step 2 — trajectory features**  
Aggregate `frame_index` rows per trajectory: state occupancy ratios, directed transition rates/counts, dominant state, length, support flag.

**Step 3 — frame structural features** (`scripts/structural_system_features.py`)  
Per frame, per trajectory (once per system, **not** per MSM model): RMSD to first frame, radius of gyration, five key Cα–Cα distances `(1,42)`, `(1,28)`, `(17,42)`, `(11,42)`, `(18,42)`, residue–residue contacts (pair-specific threshold = mean distance over all frames in the run), ligand contacts (6 Å cutoff for TMP/SPA).

**Step 3b — structural index**  
Load Step 3 CSV into SQLite (`structural_index.db`) for fast random access during Steps 4–5b.

**Step 4 — state summaries**  
Join `frame_index` with structural rows per group `system|model|trajectory_type|state`. Aggregate RMSD stats, RMSD histogram bins, contact frequencies, ligand contact frequencies.

**Step 5 — representative frames**  
Per state group: compute structural centroid  
\(\bar{\mathbf{v}} = [\text{rmsd}, R_g, d_{1,42}, d_{1,28}, d_{17,42}, d_{11,42}, d_{18,42}]\),  
rank frames by Euclidean distance to centroid, keep top **K** (default 5).

**Step 5b — trajectory frame counts**  
For groups that have representatives: same centroid as Step 5; per trajectory count frames in state; mark `within_threshold` if distance ≤ P10 (configurable). Includes reference trajectory for Viewer3D sync.

**Step 6 — signature residuals** (`scripts/signature_residual_system.py`)  
Per state group: histogram all Cα–Cα pair distances (bin width 0.1 Å, max 40 Å) plus per-pair mean/std. Powers StateSignature **Residues** stability scoring.

**Step 7 — state driver interactions** (`scripts/state_driver_system.py`)  
Per state group: for residue pairs with \(|i-j| \ge 3\), min heavy-atom distance per frame → mean, std, soft score \(1/(1+\exp(\beta(d-\lambda d_0)))\) with \(d_0\) = pair median; ligand min-distance per residue. Powers StateDriver arc diagram and ligand rows.

---

## 3. Output files (`public/data/Residual/`)

For each file: **what it contains** · **how it is created** · **why we need it** · **dashboard use**.

---

### `frame_index.csv`

| | |
|---|---|
| **Contains** | One row per frame: `system`, `model`, `trajectory_type`, `trajectory_name`, `epoch`, `local_frame`, `state`, `xtc_frame_index`, `global_order` |
| **Created by** | Step 1 — `buildFrameIndex.js` |
| **Why** | Single bridge table linking abstract MSM labels to physical XTC frames and timeline position |
| **Used for** | Prerequisite for Steps 2–7; implicit in all 3D linking (`xtc_frame_index`); documents concat → source trajectory mapping |

---

### `trajectory_features.csv`

| | |
|---|---|
| **Contains** | One row per trajectory: `state0_ratio`…`state3_ratio`, `trans_A_to_B` rates and counts, `num_transitions`, `dominant_state`, `trajectory_length`, `support` |
| **Created by** | Step 2 — `buildTrajectoryFeatures.js` streaming `frame_index.csv` |
| **Why** | Offline snapshot of fingerprint metrics (validation, export, external analysis) |
| **Used for** | **Not loaded at runtime** — Compare recomputes the same metrics live from `states*.txt` |

---

### `frame_structural_features.csv`

| | |
|---|---|
| **Contains** | One row per frame: `system`, `trajectory_name`, `local_frame`, `xtc_frame_index`, `rmsd`, `radius_of_gyration`, `contact_features` (JSON), `ligand_contact_features` (JSON) |
| **Created by** | Step 3 — `scripts/structural_system_features.py` via `buildFrameStructuralFeatures.js` |
| **Why** | Expensive MDAnalysis run done once; stores per-frame geometry for all downstream structural aggregates |
| **Used for** | Source for `structural_index.db`; indirect input to Steps 4–5b; T1/T3/T4 structural measures |

---

### `structural_index.db`

| | |
|---|---|
| **Contains** | SQLite table `frames`: RMSD, Rg, five key distances, `contacts_json`, `ligand_json` keyed by `(system, trajectory_name, xtc_frame_index)` |
| **Created by** | Step 3b — `structuralIndexDb.js` (auto-rebuilt in Step 4 if CSV is newer) |
| **Why** | Random frame lookup without re-parsing a multi-GB CSV during Node preprocess |
| **Used for** | Steps 4, 5, 5b internal; enables fast feature-vector reads for centroid / representative scoring |

---

### `state_summary.csv`

| | |
|---|---|
| **Contains** | Per `system|model|trajectory_type|state`: `frame_count`, `avg_rmsd`, `std_rmsd`, `min_rmsd`, `max_rmsd`, `avg_radius_of_gyration`, `avg_distance_1_42` |
| **Created by** | Step 4 — `buildStateSummaries.js` |
| **Why** | Compact per-state structural overview for experts |
| **Used for** | Loaded by `conformationalDriversData.js` — StateSignature / legacy driver summaries |

---

### `rmsd_by_state.csv`

| | |
|---|---|
| **Contains** | Per state group: RMSD histogram bins (`bin_start`, `bin_end`, `count`, `fraction`) — 0.5 Å bins up to 15 Å |
| **Created by** | Step 4 — `buildStateSummaries.js` |
| **Why** | Distribution shape per Markov state (compact vs extended) |
| **Used for** | `loadRmsdByStateRows()` — RMSD distribution views in Analysis3D tooling |

---

### `state_contact_maps.json`

| | |
|---|---|
| **Contains** | Per state group: ranked residue–residue contacts (`pair`, `contact_frequency`, `avg_distance`) and `pair_distances` stats |
| **Created by** | Step 4 — aggregates `contact_features` from structural index joined via `frame_index` |
| **Why** | Pre-aggregated contact landscape per Markov state |
| **Used for** | `loadContactMaps()` — contact frequency matrices, overall pair means in StateSignature |

---

### `ligand_contacts.csv`

| | |
|---|---|
| **Contains** | Per state (zsab3/zsab4): `resid`, `contact_frequency`, `avg_min_distance` to ligand |
| **Created by** | Step 4 — aggregates `ligand_contact_features` |
| **Why** | Drug–protein proximity summary per MSM state (T3) |
| **Used for** | Ligand-aware analysis; complements StateDriver ligand rows |

---

### `representative_frames.csv`

| | |
|---|---|
| **Contains** | Top-K frames per state group: `trajectory_name`, `local_frame`, `xtc_frame_index`, `representative_rank`, `representative_score` (distance to centroid) |
| **Created by** | Step 5 — `buildRepresentativeFrames.js` (default K=5, env `REPRESENTATIVE_TOP_K`) |
| **Why** | Answers T2 — which frames best typify each Markov state structurally |
| **Used for** | Viewer3D default pose on state change; StateDriver / StateSignature representative lookup; Step 5b reference trajectory |

---

### `state_trajectory_frame_counts.json`

| | |
|---|---|
| **Contains** | Keys `system|model|original|state` → `{ reference, rmsd_threshold, threshold_percentile, trajectories: [{ name, total, within_threshold }] }` |
| **Created by** | Step 5b — `buildStateTrajectoryFrameCounts.js` |
| **Why** | Per-trajectory breakdown of state occupancy with structural “core vs outlier” split |
| **Used for** | StateSignature **Frames** tab — stacked blue/green bars; green = closest 10% to state centroid |

---

### `state_signature_residuals.json`

| | |
|---|---|
| **Contains** | Format `distance_histogram_v2`: `_meta` (bin width 0.1 Å, max 40 Å) + per group `pair_hist`, `pair_stats` (`mean`, `std`, `n`) for all Cα–Cα pairs |
| **Created by** | Step 6 — `scripts/signature_residual_system.py` per system, merged by `buildSignatureResiduals.js` |
| **Why** | Store full distance distributions so UI can score stability at any tolerance without re-reading XTC |
| **Used for** | StateSignature **Residues** tab — stability heatmap (`|d − μ|/μ ≤ tolerance%`) |

---

### `state_driver_interactions.json`

| | |
|---|---|
| **Contains** | Per group `system|model|original|state`: `pairs` (min-distance stats + soft score per residue pair), `ligand` (per-residue ligand proximity for TMP/SPA systems) |
| **Created by** | Step 7 — `scripts/state_driver_system.py` for zsab2, zsab3, zsab4 |
| **Why** | Differential interaction view comparing systems on the same Markov state |
| **Used for** | StateDriver tab — arc diagram (residue–residue), bottom rows (Free / TMP / SPA ligand contacts), Viewer3D highlight on click |

---

## 4. Source code map

```
src/preprocess/
  paths.js                          DATA_ROOT, OUTPUT_DIR
  buildFrameIndex.js                Step 1 logic
  runFrameIndex.js
  buildTrajectoryFeatures.js        Step 2 logic
  runTrajectoryFeatures.js
  buildFrameStructuralFeatures.js   Step 3 orchestration
  runFrameStructuralFeatures.js
  structuralIndexDb.js              Step 3b + shared db access
  runStructuralIndex.js
  buildConcatLookup.js              Concatenated frame → XTC resolver
  buildStateSummaries.js            Step 4 logic
  runStateSummaries.js
  buildRepresentativeFrames.js      Step 5 logic
  runRepresentativeFrames.js
  buildStateTrajectoryFrameCounts.js Step 5b logic
  runStateTrajectoryFrameCounts.js
  buildSignatureResiduals.js        Step 6 orchestration
  runSignatureResiduals.js
  buildStateDriverInteractions.js   Step 7 orchestration
  runStateDriverInteractions.js
  writeFrameIndexCsv.js             CSV helpers

scripts/
  structural_system_features.py     Step 3 — per-frame MDAnalysis metrics
  signature_residual_system.py      Step 6 — Cα distance histograms
  state_driver_system.py            Step 7 — heavy-atom interactions
  structural_trajectory_features.py  (older single-trajectory variant; not used by npm Step 3)
  xtc_frame_coords.py               Coordinate export helper (not in main pipeline)

public/data/Residual/
  frame_index.csv
  trajectory_features.csv
  frame_structural_features.csv
  structural_index.db
  state_summary.csv
  rmsd_by_state.csv
  state_contact_maps.json
  ligand_contacts.csv
  representative_frames.csv
  state_trajectory_frame_counts.json
  state_signature_residuals.json
  state_driver_interactions.json
```

---

## 5. Task → output quick reference

| Challenge task | Primary outputs | Primary UI |
|---|---|---|
| **T1** Conformational drivers of state assignment | `frame_structural_features.csv`, `state_contact_maps.json` | StateSignature, structural summaries |
| **T2** Representative frames | `representative_frames.csv` | Viewer3D, StateSignature Frames reference |
| **T3** Residue & ligand interactions | `state_driver_interactions.json`, `ligand_contacts.csv`, `state_contact_maps.json` | StateDriver |
| **T4** Link abstract views to 3D | `frame_index.csv`, `representative_frames.csv` | Brush/click → Viewer3D |
| Ensemble comparison | `states*.txt` (runtime) + `state_driver_interactions.json` | Compare matrices, StateDriver |
