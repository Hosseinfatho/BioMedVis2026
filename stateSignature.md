# StateConformationSignature (Signature tab)

Tab in **Analysis3D → Signature** with two inner views: **Residues** and **Frames**.

## Residues — StateSignature stability matrix
- **Preprocess:** Per state, store all Cα–Cα distances per pair `(i,j)` across frames (0.1 Å histogram + μ, σ).
- **Score:** Count frames where `|d − μ| / μ ≤ displacement%` (μ = mean distance for that Ri,j in the state). Default **1%**.
- **UI:** **Max displacement (%)** — try 0.5, 1, 5, 10 to tune stability.
- **Run:** `npm run preprocess:signature-residuals`

## Frames — stacked bar histogram

For each trajectory (sorted, numbered on X-axis):

| Layer | Meaning | Color |
|---|---|---|
| **Full bar height** | All frames assigned to the selected Markov state | blue + green |
| **Blue (bottom)** | State frames **above** the RMSD threshold vs reference | `#8eb5f0` |
| **Green (top)** | State frames **within** the RMSD threshold vs reference | `#4caf50` |

**Example:** Trajectory 1 has **2000** frames in State 0. **1200** have structural distance to the reference ≤ threshold → bar height 2000, green segment 1200, blue segment 800.

### Workflow
1. Collect all frames where `trajectory.states[frame] === selectedState`
2. Reference frame = rank-1 row in `representative_frames.csv` for that state
3. For each state frame, compute structural distance to the reference (RMSD + Rg + key distances feature vector)
4. Threshold = P60 of structural distance to state centroid (override: `THRESHOLD_PERCENTILE=60`)
5. Green = frames ≤ threshold; blue = other state frames
6. Draw stacked bars; click bar → load representative (or first state) frame in Viewer3D

### Inputs
- `trajectory.states` from Compare `systemsData` (total bar height)
- `representative_frames.csv` (reference frame)
- `state_trajectory_frame_counts.json` (precomputed green/blue counts) — from `npm run preprocess:state-trajectory-frame-counts`
- `frame_index.csv` + `structural_index.db` (used at preprocess time)

### Files
`Signature.jsx`, `SignatureResidualMatrix.jsx`, `TrajectoryFrameHistogram.jsx`, `SignatureTopPairs.jsx`, `utils/signatureData.js`, `preprocess/buildSignatureResiduals.js`

We identify the conformational changes responsible for a Markov state by finding residue-pair distance patterns that are stable within that state. For each selected system and state model, we collect all frames assigned to the selected state, compute all residue-residue C-alpha distances, bin those distances into 11 levels, and count how often each residue pair remains in its most common distance range. Residue pairs with the highest dominant-bin counts form the SignatureResidual of the selected state. By linking those residue pairs to representative 3D frames, the user can see where the structurally stable pattern occurs on the molecule.

The SignatureResidual Matrix is used to identify residue-pair conformations that remain stable inside a selected Markov state. For a selected system, model, and state, we first collect all frames assigned to that state. For every frame, we calculate the Cα–Cα distance between every residue pair (i, j), producing a 42×42 residue-distance matrix per frame. Then, for each residue pair, we count how often its distance stays within the same distance range across all frames of that state. To make the comparison stable, distances are grouped into levels: <1 Å, <2 Å, <3 Å, …, <10 Å, and >10 Å. If a residue pair repeatedly falls into the same or very similar distance level across many frames, it has minimum conformational change inside that state and receives a high signature score. This means the pair represents a stable structural pattern of that Markov state. The final SignatureResidual Matrix shows these stable residue-pair signatures, and clicking a cell highlights the corresponding residues in the 3D viewer.

A slightly more complete version including comparison to other states:

The SignatureResidual Matrix measures which residue-pair distances are most stable inside a selected Markov state and therefore may represent the conformational signature of that state. For each frame assigned to the selected state, the component calculates all residue–residue Cα distances and converts each distance into one of 11 bins: <1 Å, <2 Å, <3 Å, …, <10 Å, and >10 Å. For each residue pair (i, j), the component counts how consistently that pair remains in the same distance bin across frames of the selected state. A high value means the residue pair has minimum distance change inside that state. To make the result state-specific, this stability can also be compared with the same residue pair in other states, so residue pairs that are stable only in the selected state are emphasized. The final matrix highlights residue pairs whose distances remain consistent within the state and helps explain which conformational pattern is associated with the Markov state assignment.