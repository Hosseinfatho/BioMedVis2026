# Comparison (trajectory timeline charts)

> **Master doc:** [`../../../../explain.md`](../../../../explain.md) §7 · **Matrices below:** `../compare/compare.md`

**Component 1 (visual output)** — per-system **epoch timeline** (left) and **Markov state chart** (right). Shows *when* simulations run and *which states* they visit over time.

Shell: `Comparison.jsx` · Data from Control Panel **Generate** (`App.jsx`).

---

## What this component does

Answers for experts:

- **When** did each adaptive MD simulation run relative to others? (epoch / scheduling view)
- **Which Markov state** is assigned at each frame along each trajectory?
- **Two systems at once:** overlay Free Aβ42 vs drug-bound on the same time axis (dual mode)
- **Linked highlighting:** brush/hover on Compare matrices below highlights the same trajectory columns here; active **motif** paths glow on charts

This is the **ensemble timeline layer** — abstract MSM labels over simulation time — before fingerprint matrices and 3D analysis.

---

## Why it exists

Before comparing fingerprints or residue contacts, experts need **temporal context**:

| Question | Chart |
|---|---|
| How long did simulation X run? | Epoch panel bar length |
| When did epoch 10 simulations start? | Epoch panel X position |
| Does trajectory flicker between states? | State panel color bands |
| Do two systems overlap in time? | Dual overlay with time shift |
| Which trajectories match motif 0→2? | Motif highlight bands (when motif active) |

Comparison charts share `selection`, `hoverIndex`, and `matrixSlots` with **Compare** below so brushing one panel highlights the other.

---

## Data used

### Runtime input only — **no preprocess**

Loaded by `loadSystemData()` when user clicks **Generate** in Control Panel:

| File | Path | Used for |
|---|---|---|
| `zsabX_states2/3/4.txt` | `public/data/zsabX/` | Per-frame state arrays per trajectory |
| `zsabX_order.txt` | `public/data/zsabX/` | Start time for Original view X-axis |
| `zsabX_concatenated.txt` | `public/data/zsabX/` | Chained paths for Concatenated view |

**No** `public/data/Residual/` files are read by this component.

### Row shape (after `loadSystemData`)

Each **row** in `systemData[].rows`:

| Field | Original view | Concatenated view |
|---|---|---|
| `name` | Trajectory name (e.g. `e1s1_0`) | Path label |
| `states` | Comma-separated state array | Glued states across segments |
| `startTime` | From `order.txt` | From path metadata |
| `segments` | — | Array of `{ name, states, ... }` per glued segment |

When view mode is Concatenated, `originalRows` is also loaded (for motif search on per-segment state sequences).

---

## User options (from Control Panel)

Comparison inherits settings from `ControlPanel.jsx` — not from its own toolbar.

| Control | Options | Effect on Comparison |
|---|---|---|
| **Systems** | Multi-select zsab2, zsab3, zsab4 | One chart row per system (or dual overlay if exactly 2) |
| **State model** | 2 / 3 / 4-state MSM | Which `states*.txt` file; `numStates` for colors |
| **Trajectory view** | **Original** (default), **Concatenated** | Row layout and time axis |
| **Generate** | Button | Fetches data and renders charts |

### Original view

- Each row = one simulation trajectory
- **X-axis:** global start time from `order.txt`
- **Bar length:** frame count in states file
- **Epoch:** encoded in trajectory name (`e10s12_...` → epoch 10)

### Concatenated view

- Each row = one chained path from `concatenated.txt`
- Segments glued end-to-end from frame 0
- Rows sorted by **total length ascending** (shortest at bottom → staircase Y layout)
- Dual overlay **not available** in this mode

### Dual-system mode (exactly 2 systems selected, Original view only)

`DualComparisonRow.jsx` overlays System A and System B:

| Control | Component | Behavior |
|---|---|---|
| **Time shift B** | `ChartTimeShiftHandle` | Manual horizontal offset for System B |
| Default offset | `DEFAULT_SYSTEM_B_TIME_OFFSET` | From `utils/constants.js` |

Lets experts align simulations that started at different global times.

---

## Layout

```
Comparison.jsx
├── [2 systems + Original] → DualComparisonRow
│     ├── DualTrajectoryRows   (epoch, both systems)
│     └── DualState            (state, both systems)
└── [else] → ComparisonRow × N systems
      ├── TrajectoryRows       (epoch, left 50%)
      └── State                (state, right 50%)
```

Each `ComparisonRow` = one horizontal divider in the dashboard.

Last row shows **X-axis labels** on the state panel (`showXAxis={true}`).

---

## Linked state (from App.jsx)

Comparison receives shared props from parent — keeps sync with Compare matrices:

| Prop | Source | Effect |
|---|---|---|
| `selection` | Compare brush | Highlight brushed trajectory columns on charts |
| `hoverIndex` | Compare hover | Column hover band |
| `matrixSlots` | Compare `onSlotsChange` | Map slot index → trajectory for highlights |
| `activeMotif` | Compare MotifPanel | Motif search active |
| `hoveredMotif` | Matrix/chart hover | Emphasize one motif occurrence |
| `chartTimeOffsetB` | Dual mode handle | System B time shift |

### Motif highlighting (`ComparisonRow.jsx`)

When `activeMotif` is set:

```javascript
alignedMotifOccurrencesForSystem(activeMotif, searchRows, matrixSlots, getStates)
```

- **Original view:** search on `rows`
- **Concatenated view:** search on `originalRows` (per-segment states)

Highlights passed to `TrajectoryRows` and `State` as `globalOccurrences`.

---

## File map

```
comparison/
  Comparison.jsx           Routes single vs dual layout
  ComparisonRow.jsx        One system: epoch + state panels
  DualComparisonRow.jsx    Two systems overlay (Original only)
  comparison.md            This file

Child chart components (parent folder):
  ../TrajectoryRows.jsx    Epoch timeline (single system)
  ../State.jsx             Markov state strips (single system)
  ../DualTrajectoryRows.jsx
  ../DualState.jsx
  ../ChartTimeShiftHandle.jsx

Data utilities:
  ../../utils/loadSystemData.js
  ../../utils/buildTrajectoryTable.js
  ../../utils/buildConcatenatedTable.js
  ../../utils/parseStates.js, parseOrder.js, parseConcatenated.js
  ../../utils/motifs.js    (motif occurrence search for charts)
```

---

## Workflow (for experts)

1. Select **systems**, **state model**, and **view mode** in Control Panel.
2. Click **Generate** → Comparison charts appear.
3. Read epoch chart: simulation schedule and duration.
4. Read state chart: state persistence, transitions, rare states.
5. (Optional) With 2 systems in Original view — adjust **time shift** to align epochs.
6. Scroll to Compare section — brush matrices; same columns highlight here.
7. (Optional) Apply **motif** in Compare toolbar — matching trajectories highlight on both panels.

---

## Task mapping

| Task | How Comparison helps |
|---|---|
| **T1** Conformational changes ↔ state assignment | Visual scan of state sequences over time per trajectory |
| **T4** Connect abstract to spatial | Timeline context before drilling into matrices and Analysis3D |
| **Q4** Residue distances ↔ states | See which trajectories occupy which states before opening Analysis3D |
| **Q7** Transition drivers | Visual transition patterns; pairs with Compare motif search |
| **Q10** Brush → context | Shared selection links timeline to matrix column |

---

## Comparison vs Compare (naming)

| Folder | UI name | Role |
|---|---|---|
| **`comparison/`** | Comparison charts | Timeline + state strips (Component 1 output) |
| **`compare/`** | Compare section | Ratio matrices + rate + Analysis3D (Component 2) |

Same `viewMode` from Control Panel affects **Comparison** only. **Compare** matrices always use Original trajectories internally.

---

## Expert reading guide

| Visual | Interpret |
|---|---|
| Long epoch bar | Long simulation (many frames) |
| Left vs right position | Earlier vs later start time in adaptive campaign |
| Solid state color band | Stable residence in one MSM state |
| Rapid color changes | Frequent transitions / flicker |
| Dual overlay offset | Manual alignment of two systems on shared time axis |
| Motif highlight | This trajectory column matches the searched state path |
| Brush/hover column | Same trajectory slot as selected matrix column below |

---

## Constants (quick reference)

| Item | Notes |
|---|---|
| State colors | `getMarkovStateColor()` — same palette as matrices and Viewer3D |
| Concatenated sort | Ascending total path length |
| Dual mode guard | `viewMode !== 'original'` → shows note instead of overlay |
| Preprocess | **None** for this component |
