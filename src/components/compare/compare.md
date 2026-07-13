# Compare (fingerprint matrices)

> **Master doc:** [`../../../../explain.md`](../../../../explain.md) §8 · **Tasks:** T1, T4 · **Charts above:** `../comparison/comparison.md`

**Component 2 (lower panel)** — side-by-side **ratio matrices**, **difference view**, **rate heatmaps**, interactive **brush**, **motif search**, and mount point for **Analysis3D**.

Shell: `Compare.jsx` · Rendered after Control Panel **Generate** (`App.jsx`).

---

## What this component does

Answers for experts:

- **Per trajectory (column):** what fraction of time is spent in each Markov state, and which directed transitions dominate?
- **Across systems:** where do Free Aβ42, Aβ42 + TMP, and Aβ42 + SPA **differ** in their MSM fingerprints?
- **In a brushed window:** what are the pooled state occupancies and transition rates for selected trajectories?
- **Around events:** after alignment, compare fingerprints centered on first entry into S_k or first S_a→S_b transition.
- **Motif search:** find trajectories whose state sequence matches a pattern (e.g. `0 → 2 → 1`).

Each matrix **column** = one **adaptive-sampling slot** (prefix before `_` in trajectory name, e.g. `e10s10` from `e10s10_e3s15p0f841`). Same slot groups chained continuations across systems.

---

## Why it exists

MSM labels are abstract. Experts need a **comparative fingerprint** view:

| Without Compare | With Compare |
|---|---|
| Read state labels trajectory-by-trajectory | See occupancy + transition **ratios** at a glance |
| Hard to diff three drug conditions | System A vs B + **\|A − B\|** difference matrix |
| No local dynamics summary | **Rate matrix** aggregates brushed column window |
| No event-centered comparison | **Alignment** re-slices trajectories around transitions |

Brushing links this panel to **Analysis3D** (column click → Viewer3D trajectory) and syncs hover with **Comparison** charts above via shared `selection` / `hoverIndex` in `App.jsx`.

---

## Data used

### Runtime input (no preprocess for matrices themselves)

Compare loads data **independently** of the Control Panel Generate button (but appears only after Generate):

```javascript
loadSystemData(id, selectedModel, 'original')  // always 'original'
```

| File | Path | Used for |
|---|---|---|
| `zsabX_states2.txt` / `states3` / `states4` | `public/data/zsabX/` | Per-frame Markov state arrays |
| (implicit) trajectory names | inside states files | Column slot keys via `slotKey()` |

**Important:** Matrix columns, brush, and rate aggregation **always use Original trajectories**. The Control Panel **Concatenated** view mode affects only the **Comparison** charts above — not this panel.

### Preprocess used indirectly (via Analysis3D)

When Compare renders, it mounts `Analysis3D` at the bottom:

| Preprocess output | Used by |
|---|---|
| `representative_frames.csv` | Viewer3D default poses on state select |
| `state_signature_residuals.json` | StateSignature tab |
| `state_driver_interactions.json` | StateDriver tab |
| `state_trajectory_frame_counts.json` | StateSignature Frames tab |

See [`../Analysis3D/3Danalysis.md`](../Analysis3D/3Danalysis.md) for StateSignature and StateDriver detail.

---

## User options (toolbar)

Three sections separated by `|`:

### 1. Systems (`compare-toolbar-section--systems`)

| Control | Behavior |
|---|---|
| **Checkboxes** | Free Aβ42 · Aβ42 + TMP · Aβ42 + SPA (at least one must stay checked) |
| **Compare** | Shows one matrix per checked system (requires **≥ 2** selected) |

**Before Compare:** only the **first** checked system's matrix is shown (preview).

**After Compare:** all checked systems (2 or 3) appear as stacked ratio matrices — **no Difference row**.

Default: all three systems checked.

### 2. Alignment (`compare-toolbar-section--alignment`)

> **Detail:** [`alignment.md`](alignment.md)

Dropdown built by `buildAlignmentOptions(numStates)` (`utils/alignment.js`):

| ID | Label | Effect on each trajectory |
|---|---|---|
| `none` | From frame 0 (default) | Full state sequence |
| `entry:s` | First entry into S{s} | Slice anchor ±300 frames around first frame in state s |
| `trans:a->b` | First S{a}→S{b} transition | Slice anchor ±300 frames around first directed change a→b |

Alignment applies to **feature extraction** and **rate aggregation** via `getMatrixStates(row, 'original', alignmentId)`.

If anchor not found in a trajectory → empty aligned window → zero features for that slot.

### 3. Motif pattern (`compare-toolbar-section--motif`)

| Control | Behavior |
|---|---|
| **S0, S1, … buttons** | Append state to draft sequence |
| **Draft label** | Shows `0 → 2 → 1` or `Click states…` |
| **Apply** | Activates motif search; highlights paths in matrices |
| **Clear** | Resets draft and active motif |

Motif object: `{ states: [...], transitions: [[from,to], ...] }` from `motifFromStates()`.

---

## Matrix semantics

### Rows (`buildFeatureRows`)

For N Markov states:

1. **State rows:** S0, S1, …, S_{N−1}
2. **Transition rows:** all directed S_a → S_b where a ≠ b (N(N−1) rows)

### Per-column values (`computeTrajectoryFeatures`)

For aligned state sequence of one trajectory slot:

**State occupancy ratio:**

\[
r_s = \frac{\#\{t : s_t = s\}}{T}
\]

**Transition ratio** for directed change a → b:

\[
r_{a \to b} = \frac{\#\{t : s_{t-1}=a,\; s_t=b\}}{\text{total directed changes}}
\]

**Difference column** (after Compare): removed — side-by-side system matrices only.

**Compare mode (2–3 systems):** each selected system gets its own ratio matrix and rate heatmap; trace layers toggle per system (no Difference layer).

### Column order

Shared slot list: System A order first, then any B-only slots (`featuresBySlot` in `Compare.jsx`). Keeps A, B, and Difference matrices **column-aligned**.

### Slot deduplication

Multiple trajectories can share a slot prefix. For each slot, the row with **latest `startTime`** wins (`featuresBySlot`).

---

## Interactive features

### Brush (`InteractiveMatrix.jsx`)

| Action | Effect |
|---|---|
| Drag on matrix | Select column range `{ start, end }` → shared `selection` in App |
| Resize handles | Adjust brush left/right edge |
| Move selection | Drag selected region |
| Hover column | Red vertical band; syncs with Comparison charts |
| Click empty area | New selection + `onColumnActivate` → Viewer3D frame 0 for that trajectory |
| **Wheel** | Zoom column viewport (anchor column) |
| **Shift + wheel** | Pan viewport horizontally |

Viewport state: `{ viewStart, viewCount }` from `matrixViewport.js`.

### State trace (`Trace.jsx`)

Row above matrices — mini state trajectories per visible column.

**Layers panel:** toggle System A, System B (after Compare), Difference traces.

Height: `TRACE_HEIGHT = 80` px.

### Rate matrix (`RateMatrix.jsx`)

Below each ratio matrix — N×N heatmap for **brushed window** (intersection of selection and visible viewport).

**Diagonal:** state occupancy percentages (sum to 100%):

\[
\hat{p}_i = \frac{n_i}{\sum_k n_k}
\]

**Off-diagonal:** transition percentages (sum to 100% over directed changes):

\[
\hat{p}_{i \to j} = \frac{n_{i \to j}}{\sum_{a \neq b} n_{a \to b}}
\]

Pools all trajectories whose slot falls in `[rateStart, rateEnd]`.

**Difference rate matrix:** `rateMode="diff"` → `|rateA − rateB|` per cell; shows A and B breakdowns in tooltips.

### Motif highlighting (`RatioMatrix.jsx` + `motifs.js`)

When motif is active:

- `motifBundlesForSystem()` finds matching transition paths per system
- Sankey-style ribbons connect motif cells across columns
- Hover on ribbon syncs `hoveredMotif` → highlights same occurrence in Comparison charts above

---

## File map

```
compare/
  Compare.jsx              Shell: toolbar, data load, column build, Analysis3D mount
  InteractiveMatrix.jsx    Brush overlay + RateMatrix wrapper
  RatioMatrix.jsx          Canvas ratio heatmap + motif ribbons
  RateMatrix.jsx           N×N rate grid (HTML/CSS)
  MotifPanel.jsx           Motif draft UI
  layout.js                LABEL_W, ROW_H, matrixCanvasHeight
  glyphs.js                State/transition cell drawing
  compare.md               This file

Related (outside folder):
  ../Trace.jsx             State trace row
  ../Analysis3D/           Mounted when data loaded
  ../../utils/
    computeTransitionFeatures.js   Feature + rate math
    alignment.js                   Alignment options + slicing
    motifs.js                      Motif search + bundles
    loadSystemData.js              Fetch states*.txt
    slotKey.js                     Column slot from trajectory name
    matrixViewport.js              Zoom/pan/visible selection
```

---

## Workflow (for experts)

1. **Generate** in Control Panel (loads Comparison charts).
2. Compare section appears — pick **System A** and **System B**.
3. Optionally set **Alignment** (e.g. first S0→S2 transition).
4. Click **Compare** → third (Difference) matrix appears.
5. **Brush** columns of interest → Rate matrix updates for that window.
6. **Apply motif** (e.g. `0 → 2`) → ribbons show matching trajectories.
7. **Click column** → Viewer3D loads trajectory; use StateSignature / StateDriver for residue detail.

---

## Task mapping

| Task | How Compare helps |
|---|---|
| **T1** State assignment drivers | Ratio + rate matrices show which states/transitions characterize each trajectory; alignment compares around events |
| **T4** Link abstract → 3D | Brush + column click → Viewer3D; Analysis3D tabs for residue-level follow-up |
| **Q7** Transition drivers | Alignment on S_a→S_b; motif search for transition sequences |
| **Q8** Drug comparison | A vs B + Difference matrices |
| **Q10** Brush → 3D | Core brushing design |

---

## Constants (quick reference)

| Constant | Value | File |
|---|---|---|
| `LABEL_W` | 64 | `layout.js` |
| `ROW_H` | 12 | `layout.js` |
| `COL_HEADER_H` | 20 | `layout.js` |
| `TRACE_HEIGHT` | 80 | `Trace.jsx` |
| Alignment window | ±300 frames | `alignment.js` |
| Matrix view mode | always `'original'` | `Compare.jsx` |

---

## Expert reading guide

| Visual | Interpret |
|---|---|
| Bright state row cell | High occupancy — trajectory spends much time in that MSM state |
| Bright transition row | Dominant directed change (e.g. frequent 0→2) |
| Difference cell near 0 | Systems agree on that feature for this slot |
| Large difference cell | Drug condition changes occupancy or transition propensity |
| Rate diagonal | Pooled state mix in brushed trajectories |
| Rate off-diagonal | Which transitions happen in the brushed window |
| Motif ribbon | Trajectory column participates in the searched state path |
