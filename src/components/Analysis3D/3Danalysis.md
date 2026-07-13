# Analysis3D — 3D residue analysis (Component 3)

> **Master doc:** [`../../../../explain.md`](../../../../explain.md) §9 · **Mounted from:** `compare/Compare.jsx`

**ConformaLens Component 3** — links Markov-state **ensemble analytics** to **residue-level 3D structure**. Mounted below Compare matrices when trajectory data is loaded.

Answers challenge tasks **T2** (representative frames), **T3** (residue contacts + ligand proximity), and **T4** (abstract views → 3D).

---

## Table of contents

1. [Overview and layout](#1-overview-and-layout)
2. [Data and preprocessing](#2-data-and-preprocessing)
3. [Linked views](#3-linked-views)
4. [Viewer3D](#4-viewer3d)
5. [3D Computation Panel](#5-3d-computation-panel)
6. [StateSignature tab](#6-statesignature-tab)
7. [StateDriver tab](#7-statedriver-tab)
8. [StateSignature vs StateDriver](#8-statesignature-vs-statedriver)
9. [Preprocess dependency graph](#9-preprocess-dependency-graph)
10. [File map](#10-file-map)
11. [Methods paragraphs (paper-ready)](#11-methods-paragraphs-paper-ready)
12. [References](#12-references)

---

## 1. Overview and layout

### Shell (`Analysis3D.jsx`)

```
┌─────────────────────────────────────────────────────────────┐
│ 3D Computation Panel (67%)     │  Viewer3D (33%)             │
│ Tabs: StateSignature | StateDriver │  3Dmol ribbon + spheres │
│ Toolbar controls (portal)      │  Trajectory / Frame / State  │
└─────────────────────────────────────────────────────────────┘
```

| Piece | File | Role |
|---|---|---|
| Shell | `Analysis3D.jsx` | Shared `markovState`, `viewerTarget`, `residueHighlight` |
| Computation panel | `3DComputationPanel/3DComputationPanel.jsx` | Tab shell + toolbar portal |
| Toolbar portal | `ComputationToolbarPortal.jsx` | Renders tab controls in panel header |
| Viewer | `Viewer3D/Viewer3D.jsx` | 3Dmol molecular viewer |

**Props from Compare:** `systemsData`, `defaultSystemId`, `defaultModelId`, `viewerTarget` (matrix column click).

**Shared state inside Analysis3D:**

| State | Propagates to |
|---|---|
| `markovState` | Both tabs + Viewer3D state badge |
| `activeViewerTarget` | Viewer3D trajectory + frame |
| `residueHighlight` | Viewer3D pair/residue/ligand highlight |

On external `viewerTarget` change (Compare brush click), viewer loads that trajectory at frame 0.

### Tabs

| Tab | Question |
|---|---|
| **StateSignature** | Which pairs are **distance-stable** in a state? Which trajectories **populate** the state? |
| **StateDriver** | Which **contacts** and **ligand-facing residues** characterize a state? How do systems **differ**? |

Both tabs use trajectory type **`original`** only.

---

## 2. Data and preprocessing

### Runtime text data (no preprocess)

| Source | Used by |
|---|---|
| `public/data/zsabX/zsabX_states*.txt` | Viewer3D state at frame; StateSignature Frames bar heights |
| Trajectory rows from Compare `systemsData` | Viewer3D trajectory dropdown |

### Preprocess outputs (`public/data/Residual/`)

| File | Step | Consumer |
|---|---|---|
| `frame_index.csv` | 1 | All preprocess (prerequisite) |
| `representative_frames.csv` | 5 | Viewer3D defaults; both tabs on state change |
| `state_signature_residuals.json` | 6 | StateSignature **Residues** |
| `state_trajectory_frame_counts.json` | 5b | StateSignature **Frames** |
| `state_driver_interactions.json` | 7 | StateDriver |
| `structural_index.db` | 3b | Frames preprocess only |

### Raw trajectories (preprocess only, not browser)

`trajectories/ZS-abX/filtered.pdb` + `output.filtered.xtc` — MDAnalysis in offline scripts.

Viewer3D topology: `filtered.pdb`. Per-frame XTC coordinates in browser: **partially wired** via `viewerTrajectory.js` / representative frames.

---

## 3. Linked views

```
Compare matrix column click
        ↓
viewerTarget → Analysis3D → Viewer3D

StateSignature cell / bar click
        ↓
onViewerTargetChange + onResidueHighlightChange

StateDriver arc / ligand / residue click
        ↓
onViewerTargetChange + onResidueHighlightChange
```

| Action | Viewer3D result |
|---|---|
| Matrix column click | Load trajectory, frame 0 |
| Change state (either tab) | Rank-1 representative frame |
| StateSignature pair click | Highlight i, j Cα + dashed cylinder |
| StateDriver arc click | Highlight pair; winner-system frame |
| StateDriver ligand click | Highlight residue + ligand flag |

Representative frames: `findRepresentativeFrame()` from `representative_frames.csv`.

---

## 4. Viewer3D

**File:** `Viewer3D/Viewer3D.jsx` · **Library:** 3Dmol.js

Residue-level 3D structure for Aβ42 (42 Cα atoms).

### Toolbar controls

| Control | Source | Behavior |
|---|---|---|
| **System** | `systems` prop | zsab2 / zsab3 / zsab4 |
| **Trajectory** | `trajectoryRows` | Simulation dropdown |
| **Frame** | Local index | 0 … maxFrame |
| **State badge** | `states[frame]` | Markov state at frame (`getMarkovStateColor`) |

### Visual encoding

| Element | Encoding | Notes |
|---|---|---|
| **Ribbon** | Cartoon, **residue rainbow** N→C (3Dmol Sinebow) | Fixed by residue index; does not change with frame |
| **Cα spheres** | Color = **Markov state** at selected frame | Same palette as Compare matrices |
| **Color bar** | Residue position scale (`residueSpectrum.js`) | No state legend on bar |
| **Pair highlight** | Orange Cα spheres + red dashed cylinder | From StateSignature / StateDriver |
| **Single residue** | Orange cartoon on residue | Ligand or filtered residue |

### Data sources

| Input | Path |
|---|---|
| Topology | `trajectories/ZS-abX/filtered.pdb` (via `pdbUrl` in `trajectoryConfig.js`) |
| States per frame | `public/data/zsabX/` via loaded trajectory rows |
| Coordinates | `viewerTrajectory.js` — representative / frame coords when available |

**Limitation:** Live full-trajectory XTC streaming in browser not complete; representative poses drive most linked selections.

### Files

```
Viewer3D/
  Viewer3D.jsx
  Viewer3DColorBar.jsx
  residueSpectrum.js
  trajectoryConfig.js
  viewerTrajectory.js
```

---

## 5. 3D Computation Panel

**File:** `3DComputationPanel/3DComputationPanel.jsx`

- Tab list: StateSignature | StateDriver
- `ComputationToolbarPortalProvider` — active tab renders controls into header slot
- Passes shared callbacks: `onMarkovStateChange`, `onViewerTargetChange`, `onResidueHighlightChange`

---

## 6. StateSignature tab

**File:** `tabs/signature/StateSignature.jsx`

Answers: *which residue pairs are structurally stable inside a Markov state?* (Residues) and *how does each trajectory contribute frames to that state?* (Frames).

### Inner tabs

| Tab | View | Question |
|---|---|---|
| **Residues** | 42×42 matrix + top-10 list | Minimum **Cα–Cα distance change** inside selected state? |
| **Frames** | Stacked bar histogram | How many state frames per trajectory; how many near **structural centroid**? |

### Toolbar controls

| Control | Notes |
|---|---|
| **System** | zsab2, zsab3, zsab4 |
| **Model** | states2 / states3 / states4 |
| **State** | Synced with parent `markovState` |
| **S{n} badge** | State color |
| **Residues / Frames** | Inner tab switch |
| **Stability tolerance (%)** | Default **1%**; range 0.1–50; Residues only |

On system / model / state change → Viewer3D loads **rank-1 representative frame**.

---

### 6.1 Residues — stability matrix (42×42)

#### Goal

Find pairs `(i,j)` whose **Cα–Cα distance** changes minimally across all frames in the selected Markov state. High **stable fraction** = **conformational signature** of that state.

#### Preprocess

```bash
npm run preprocess:frame-index
npm run preprocess:signature-residuals
```

| Item | Path |
|---|---|
| Script | `scripts/signature_residual_system.py` |
| Builder | `src/preprocess/buildSignatureResiduals.js` |
| Output | `state_signature_residuals.json` |
| Format | `distance_histogram_v2` |

**Algorithm:**

1. Load `frame_index.csv` (`trajectory_type == 'original'`)
2. Per trajectory: MDAnalysis on Cα atoms; all upper-triangle pairs (861 pairs)
3. Bin distances 0.1 Å, 0–40 Å per group `system|model|original|state`
4. Store `pair_hist`, `pair_stats` (mean, std, n), `total_frames`

#### Runtime scoring (`signatureData.js`)

Lookup: `` `${system}|${model}|original|${state}` ``

Stable if: `|d − μ| / μ ≤ displacementPercent / 100` (default **p = 1%**)

- **stableFraction** = stableCount / totalFrames
- Matrix symmetric; diagonal unused
- **Top 10:** `|i−j| > 2`; sort by stableFraction → count → std

#### Color scale

Blue (low stable fraction) → red (high); percentile norm p5–p95.

#### Interaction

Click cell or top-pair → Viewer3D representative frame + highlight `{ i, j }`.

#### Components

| File | Role |
|---|---|
| `StateSignatureResidualMatrix.jsx` | 42×42 canvas |
| `StateSignatureTopPairs.jsx` | Top-10 sidebar |
| `utils/signatureData.js` | Matrix builder |

---

### 6.2 Frames — stacked bar histogram

#### Goal

Per trajectory: frame count in selected state; split by distance to **structural centroid**.

#### Bar layers

| Layer | Meaning | Color |
|---|---|---|
| Full height | Frames in state (runtime MSM count) | blue + green |
| Green (top) | `distToCentroid ≤ τ` (~closest 10%) | `#4caf50` |
| Blue (bottom) | `distToCentroid > τ` | `#8eb5f0` |

#### Preprocess

```bash
npm run preprocess:frame-index
npm run preprocess:frame-structural
npm run preprocess:structural-index
npm run preprocess:representative-frames
npm run preprocess:state-trajectory-frame-counts
# optional: THRESHOLD_PERCENTILE=10
```

**Feature vector per frame:**

```text
[rmsd, radius_of_gyration, d_1_42, d_1_28, d_17_42, d_11_42, d_18_42]
```

1. Centroid = mean vector over all state frames
2. Per frame: `distToCentroid = ||v − centroid||₂`
3. Threshold τ = **P10** (default) of distances
4. Output: `state_trajectory_frame_counts.json`

**Note:** Only groups with rows in `representative_frames.csv` are processed. `reference` frame stored for Viewer3D only — not used for green/blue split.

#### Runtime

1. Bar height from live `states*.txt` count
2. Green/blue from precomputed `within_threshold`
3. Click bar → Viewer3D representative or first in-state frame

#### Components

| File | Role |
|---|---|
| `TrajectoryFrameHistogram.jsx` | Canvas stacked bars |
| `buildTrajectoryStateHistogram()` | Merges runtime + JSON |

#### State index note

State 3 exists only in **4-state** model. With states2/states3, state 3 yields empty views.

---

## 7. StateDriver tab

**File:** `tabs/stateDriver/StateDriver.jsx`

Answers: *which non-local residue–residue contacts and residue–ligand contacts characterize a Markov state — and how do Free Aβ42, TMP, and SPA differ?*

Uses three measures — **proximity**, **frequency**, **persistence** — each mapped to a visual channel.

---

### 7.1 Design: three measures

#### Proximity (distance)

- **Atoms:** min **heavy-atom** distance (`not name H*`), not Cα only
- Pairs: `|i − j| ≥ 3`; ligand: `resname MOL or segid L`
- **Visualization:** arc **bulge** (inverse `mean_distance`, scale 0.55–1.55×)

#### Frequency / occupancy

\[
\bar{s}_{ij} = \frac{1}{N} \sum_{t \in S} \text{soft}(d_{ij}(t))
\]

Stored as **`mean_soft`**. **Visualization:** arc **width** (gamma 1.75).

#### Persistence

\[
\text{persistence} = \frac{1}{1 + \sigma_d}
\]

where \(\sigma_d\) = **`distance_std`**. **Visualization:** arc **opacity**.

#### Soft-contact score (Best–Hummer)

\[
\text{soft}(d) = \frac{1}{1 + \exp(\beta(d - \lambda d_0))}, \quad d_0 = \text{histogram median}
\]

| Constant | Value |
|---|---|
| `BETA` | 5.0 Å⁻¹ |
| `LAMBDA` | 1.8 |
| `BIN_WIDTH` | 0.1 Å |
| `MAX_DISTANCE` | 40 Å |

\(d_0\) from state histogram — **not** representative frame.

---

### 7.2 Preprocess

```bash
npm run preprocess:frame-index
npm run preprocess:state-driver-interactions
```

| Item | Path |
|---|---|
| Script | `scripts/state_driver_system.py` |
| Output | `state_driver_interactions.json` |
| Format | `state_driver_v1` |

Per group `system|model|original|state`: `pairs`, `ligand`, `total_frames`.

`zsab2` has empty `ligand`. Persistence: `1/(1+distance_std)`.

---

### 7.3 Arc diagram

**What is an arc?** Curved SVG path between R1–R42 — **non-local** residue contact in selected state.

| Visual | Meaning |
|---|---|
| Width | Frequency / `mean_soft` |
| Opacity | Persistence |
| Bulge | Proximity |
| Color | Compare winner (see below) |

Legend: *Arc width → frequency · Arc opacity → persistence · Arc length → proximity*

**Filters:** `|i−j| ≥ 3`, `displayStrength > 0.01`, top **14** arcs (user-adjustable).

**Layout:** Arcs above/below chain = **overlap avoidance only** — not TMP vs SPA.

#### Toolbar

| Control | Notes |
|---|---|
| System checkboxes | ≥1 required (zsab2, zsab3, zsab4) |
| Model, State, S{n} badge | |
| Arcs limit | Default 14 + **All** button |

#### System colors

| System | Color | Ligand |
|---|---|---|
| zsab2 Free | `#636efa` | — |
| zsab3 TMP | `#1b9e77` | TMP row |
| zsab4 SPA | `#d95f02` | SPA row |
| Shared / tie | `#c8c8c8` | |
| Selected | `#7570b3` | |

#### Compare logic (`DIFF_EPSILON = 0.03`)

| Systems | Winner rule |
|---|---|
| 1 | That system's color |
| 2 | `\|strengthA − strengthB\| ≤ 0.03` → gray shared; else stronger wins |
| 3 | Top wins if gap > 0.03; else shared |

Two-system arc filter: merge **shared**, **sysA-stronger**, **sysB-stronger** buckets.

#### Interaction

| Click | Effect |
|---|---|
| Arc | Highlight `{ i, j }`; winner-system frame |
| Residue node | Filter arcs to residue; highlight in 3D |
| Ligand marker | Highlight `{ i, ligand }`; system frame |

---

### 7.4 Ligand row

**TMP / SPA** — drug molecules near Aβ42 in zsab3/zsab4.

| Property | Encoding |
|---|---|
| Position | Under residue number (hill wave x-axis) |
| Size | `7.5 + strength × 2.5` |
| Limit | Top **10** per system |
| zsab2 | No row (no ligand) |

Geometric closeness only — not specific chemistry (H-bond, etc.).

| | Arc | Ligand circle |
|---|---|---|
| Connects | residue ↔ residue | residue ↔ drug |
| zsab2 | yes | no |
| zsab3/4 | yes | yes |

---

### 7.5 StateDriver components

| File | Role |
|---|---|
| `StateDriver.jsx` | Toolbar, selection, viewer callbacks |
| `useDriverInteractionData.js` | JSON fetch + bundle |
| `stateDriverMetrics.js` | Scoring, layout, encodings |
| `DifferentialArcInteractionDiagram.jsx` | Hill + wave + arcs |
| `LigandContactRows.jsx` | Ligand markers |
| `StateDriverArcLimit.jsx` | Arc count control |
| `InteractionLegend.jsx` | Encoding legend |

---

### 7.6 StateDriver constants

```javascript
DEFAULT_ARC_LIMIT = 14
DEFAULT_LIGAND_LIMIT = 10
DIFF_EPSILON = 0.03
MIN_SEQ_SEP = 3
ARC_WIDTH_GAMMA = 1.75
ARC_PROXIMITY_SCALE_MIN = 0.55
ARC_PROXIMITY_SCALE_MAX = 1.55
```

---

## 8. StateSignature vs StateDriver

| | **StateSignature** | **StateDriver** |
|---|---|---|
| Question | Which pairs are **distance-stable** in state? | Which **contacts** characterize / differ across systems? |
| Atoms | Cα–Cα | Min heavy-atom |
| Pair filter | All pairs in histogram; top list `\|i−j\| > 2` | `\|i−j\| ≥ 3` for arcs |
| Score | Stable fraction around pair μ | Mean soft-contact (Best–Hummer) |
| Reference | Each pair's μ in state | Pair median d₀ in state |
| Ligand | No | Yes (TMP/SPA) |
| Preprocess | `signature-residuals` | `state-driver-interactions` |
| JSON | `state_signature_residuals.json` | `state_driver_interactions.json` |

---

## 9. Preprocess dependency graph

```text
frame_index.csv
├── signature-residuals ──→ state_signature_residuals.json     [StateSignature Residues]
│     (+ trajectories PDB+XTC, MDAnalysis)
│
├── state-driver-interactions ──→ state_driver_interactions.json   [StateDriver]
│     (+ trajectories PDB+XTC, MDAnalysis)
│
└── (with structural_index.db + representative_frames.csv)
      state-trajectory-frame-counts ──→ state_trajectory_frame_counts.json   [StateSignature Frames]
            ↑ frame-structural + structural-index
            ↑ representative-frames ──→ representative_frames.csv   [Viewer3D + both tabs]
```

---

## 10. File map

```
Analysis3D/
  Analysis3D.jsx                    Shell + shared state
  3Danalysis.md                     This file
  ComputationToolbarPortal.jsx      Toolbar portal
  3DComputationPanel/
    3DComputationPanel.jsx          Tab shell
    tabs/signature/
      StateSignature.jsx
      StateSignatureResidualMatrix.jsx
      StateSignatureTopPairs.jsx
      TrajectoryFrameHistogram.jsx
      ResidueSignatureMatrix.jsx    Legacy / unused
    tabs/stateDriver/
      StateDriver.jsx
      useDriverInteractionData.js
      stateDriverMetrics.js
      DifferentialArcInteractionDiagram.jsx
      LigandContactRows.jsx
      StateDriverArcLimit.jsx
      InteractionLegend.jsx
  Viewer3D/
    Viewer3D.jsx
    Viewer3DColorBar.jsx
    residueSpectrum.js
    trajectoryConfig.js
    viewerTrajectory.js

src/utils/
  signatureData.js
  conformationalDriversData.js

src/preprocess/
  buildSignatureResiduals.js
  buildStateDriverInteractions.js
  buildStateTrajectoryFrameCounts.js
  runSignatureResiduals.js
  runStateDriverInteractions.js
  runStateTrajectoryFrameCounts.js

scripts/
  signature_residual_system.py
  state_driver_system.py

public/data/Residual/
  frame_index.csv
  representative_frames.csv
  state_signature_residuals.json
  state_trajectory_frame_counts.json
  state_driver_interactions.json
  structural_index.db
```

---

## 11. Methods paragraphs (paper-ready)

**StateSignature (Residues):** For each Markov state we collect Cα–Cα distances for every upper-triangle pair across all assigned frames. Distances are aggregated into 0.1 Å histograms. For each pair we compute mean distance μ and the fraction of frames within a relative band ±p% around μ (default p = 1%). Pairs with highest stable fraction define the state's conformational signature. Sequence neighbors are excluded from the top list (|i−j| > 2).

**StateSignature (Frames):** Per trajectory, bar height counts frames in the selected state from MSM labels. Green marks the closest ~10% by Euclidean distance to the state centroid in a seven-dimensional structural feature space; blue marks the remainder.

**StateDriver:** Minimum heavy-atom distances between non-local pairs (|i−j|≥3) and residue–ligand pairs are histogrammed per state. Soft-contact scores use pair-specific median reference (Best–Hummer, β=5, λ=1.8). Mean score → arc width; distance std → opacity; mean distance → bulge. Compare mode colors arcs by stronger system (gray within ε=0.03). Ligand-facing residues appear as per-system marker rows. Selections link to the coordinated 3D viewer.

---

## 12. References

StateDriver design citations (paper bibliography):

- **Best & Hummer (2013)** — native-contact soft threshold \cite{Best2013NativeContacts}
- **Clementel et al. (2022)** — RING contact analysis \cite{Clementel2022RING3}
- **Salentin et al. (2015)** — PLIP ligand interactions \cite{Salentin2015PLIP}
- **Schaffler et al. (2025)** — DRID distance distributions for Aβ42 \cite{Schaffler2025AB42DRID}
