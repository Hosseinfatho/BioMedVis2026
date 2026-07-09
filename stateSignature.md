# StateSignature

Tab in **Analysis3D → StateSignature**.

### Inner tabs

| Tab | View | Question |
|---|---|---|
| **Residues** | 42×42 stability matrix + top pairs | Which residue pairs `(i,j)` have **minimum distance change** inside the selected state? |
| **Frames** | Stacked bar histogram per trajectory | How many frames belong to the state per trajectory, and how many are **near the state reference**? |

Shared controls: **System**, **Model**, **State** (trajectory type fixed to `original`).

---

## Residues — stability matrix (42×42)

### Goal

Find residue pairs `(i,j)` whose Cα–Cα distance changes **minimally** across all frames of the selected Markov state. These pairs are treated as the **conformational signature** of that state.

### Preprocess

```bash
npm run preprocess:signature-residuals
```

**Script:** `scripts/signature_residual_system.py`  
**Output:** `public/data/Residual/state_signature_residuals.json`  
**Format:** `distance_histogram_v2`

For each `system | model | original | state`:

- Every frame in all trajectories assigned to that state contributes one Cα–Cα distance per pair `(i,j)`.
- Distances are stored as **0.1 Å histograms** (0–40 Å).
- Per pair: **μ** (mean), **σ** (std), **n** (frame count) in `pair_stats`.

Example group key: `zsab2|states4|original|3`

### Scoring (UI)

For each pair `(i,j)` in the selected state:

1. **μ** = mean Cα–Cα distance over all state frames  
2. A frame is **stable** if relative variation is within the user tolerance:

```text
|d − μ| / μ ≤ stability_tolerance% / 100
```

equivalently `d ∈ [μ × (1 − p/100), μ × (1 + p/100)]`.

3. **Cell value** = stable fraction = (stable frame count) / (total state frames)  
4. **Top pairs** = highest stable fraction (tie-break: count, then lower σ)

**Default stability tolerance:** **1%** (UI control: **Stability tolerance (%)**, range 0.1–50, step 0.1).

The threshold is **pair-specific** (via each pair’s μ), not a fixed Å cutoff.

### Color scale

Matrix cells use `stableFraction` with percentile normalization (p5–p95 across pairs):

- **Red** = high stable fraction (strong signature)
- **Blue** = low stable fraction

Click a cell → Viewer3D loads the state representative frame and highlights residues `i` and `j`.

### UI components

| Component | Role |
|---|---|
| `StateSignature.jsx` | Toolbar, inner tabs, stability tolerance control |
| `StateSignatureResidualMatrix.jsx` | 42×42 heatmap canvas |
| `StateSignatureTopPairs.jsx` | Top 10 pairs (pair label + stable %) |
| `utils/signatureData.js` | `buildSignatureResidualMatrix`, histogram filtering |

---

## Frames — stacked bar histogram

Inner tab **Frames** in StateSignature. One stacked bar per trajectory (sorted by name, numbered 1…N on X-axis).

### Goal

Show how each trajectory contributes frames to the selected Markov state, and which of those frames are **structurally close to the state centroid** (green) vs **farther** (blue).

### Bar layers

| Layer | Meaning | Color |
|---|---|---|
| **Full bar height** | All frames assigned to the selected Markov state | blue + green |
| **Blue (bottom)** | State frames with structural distance **above** the state threshold | `#8eb5f0` |
| **Green (top)** | State frames with structural distance **at or below** the state threshold | `#4caf50` |

**Example:** Trajectory 5 has **2000** frames in State 0. **1200** are within threshold → bar height 2000, green 1200, blue 800.

### Threshold (actual code)

Implemented in `src/preprocess/buildStateTrajectoryFrameCounts.js`:

1. For each `system | model | original | state`, load every frame in that state from `frame_index.csv`.
2. Read each frame’s **structural feature vector** from `structural_index.db`:
   `[rmsd, radius_of_gyration, d_1_42, d_1_28, d_17_42, d_11_42, d_18_42]`
3. Compute the **state centroid** = mean of those vectors over all state frames.
4. For each state frame, compute **distance to centroid** = Euclidean distance between the frame vector and the centroid.
5. **Threshold** = **P10** (10th percentile) of all centroid distances in that state — roughly the **closest 10%** of state frames.
   - Default: `DEFAULT_PERCENTILE = 10`
   - Override at preprocess: `THRESHOLD_PERCENTILE=10` (env var)
6. **Green** (`within_threshold`): `distance_to_centroid ≤ threshold` (closest ~10% of frames)
7. **Blue**: `distance_to_centroid > threshold` (remaining ~90%)

The JSON field `rmsd_threshold` stores this threshold value (centroid-distance units, not literal RMSD).  
`representative_frames.csv` rank-1 frame is saved as `reference` for Viewer3D clicks — it is **not** used to compute green vs blue.

### Preprocess

```bash
npm run preprocess:state-trajectory-frame-counts
```

Optional: `THRESHOLD_PERCENTILE=10 npm run preprocess:state-trajectory-frame-counts`

**Output:** `public/data/Residual/state_trajectory_frame_counts.json`

Group key format: `system|model|original|state` (e.g. `zsab2|states4|original|3`).

Each group contains:

```json
{
  "reference": { "trajectory_name": "...", "local_frame": 123 },
  "rmsd_threshold": 26.10063,
  "threshold_percentile": 10,
  "trajectories": {
    "traj_name": { "state_frames": 2000, "within_threshold": 1200 }
  }
}
```

### Workflow (runtime UI)

1. Load precomputed counts from `state_trajectory_frame_counts.json`
2. Draw one stacked bar per trajectory (`state_frames` = total height)
3. Green segment = `within_threshold`; blue = remainder
4. Click bar → Viewer3D loads representative (or first state) frame for that trajectory

### Data sources (runtime)

| Source | Role |
|---|---|
| `state_trajectory_frame_counts.json` | Bar heights + green/blue counts (primary) |
| `loadSystemData(system, model, 'original')` | State labels must match toolbar **Model** (e.g. `states4` for State 3) |
| `representative_frames.csv` | Reference frame for Viewer3D (stored in JSON, not used for green/blue split) |
| `frame_index.csv` + `structural_index.db` | Feature vectors + centroid distance at preprocess time |

### UI components

| Component | Role |
|---|---|
| `StateSignature.jsx` | Inner tab switch Residues / Frames |
| `TrajectoryFrameHistogram.jsx` | Stacked bar canvas + legend |
| `buildTrajectoryStateHistogram()` in `signatureData.js` | Builds bar data from precomputed JSON |

### Note on state index

**State 3** exists only in the **4-state model** (`states4`). With 2-state or 3-state models, state 3 has no assigned frames and the chart is empty.

---

## Comparison with StateDriver

| | **StateDriver** | **StateSignature (Residues)** |
|---|---|---|
| Metric | contact frequency − mean across states | stable fraction within ±stability tolerance of pair μ |
| Question | which contacts differ from average? | which pairs have minimum distance change in this state? |
| Reference | ensemble mean contact freq | each pair’s own mean distance μ in the state |
| Data file | `state_contact_maps.json` | `state_signature_residuals.json` |

---

## File map

```
src/components/Analysis3D/3DComputationPanel/
  3DComputationPanel.jsx          → tab label "StateSignature"
  tabs/signature/
    StateSignature.jsx
    StateSignatureResidualMatrix.jsx
    StateSignatureTopPairs.jsx
    TrajectoryFrameHistogram.jsx
    index.js

src/utils/signatureData.js
src/preprocess/
  buildSignatureResiduals.js
  runSignatureResiduals.js
scripts/signature_residual_system.py

public/data/Residual/
  state_signature_residuals.json   → Residues tab
  state_trajectory_frame_counts.json → Frames tab (green/blue stacks)
  representative_frames.csv
  frame_index.csv
```

---

## Summary (methods paragraph)

**Residues tab:** We identify the conformational signature of a Markov state by measuring which residue-pair Cα–Cα distances remain most stable inside that state. For each selected system, model, and state, we collect all assigned frames across trajectories and record the full distance distribution for every pair `(i,j)`. For each pair we compute the mean distance μ and count how often the observed distance stays within a small relative band around μ (default ±1% stability tolerance). Pairs with the highest stable fraction represent structural interactions that change least during state membership. The 42×42 matrix and top-pair list highlight these stable contacts; clicking a cell highlights the residue pair in Viewer3D on the state representative frame.

**Frames tab:** For each trajectory, the bar height is the number of frames in the selected state. Green = the **closest ~10%** of frames by structural distance to the state centroid (**P10** threshold); blue = the rest. Feature vector: `[rmsd, Rg, five key Cα distances]`. Clicking a bar loads the trajectory in Viewer3D.
