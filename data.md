# Data overview

> **Master doc:** [`../explain.md`](../explain.md) §2 — full data inventory, flow diagram, and preprocess outputs.

This project uses two related datasets from the same CoVAMPnet Aβ42 simulations.

| Source | URL | Used for |
|---|---|---|
| CoVAMPnet full release | https://data.ciirc.cvut.cz/public/projects/2023CoVAMPnet/ | Raw MD trajectories, trained models, MSM outputs |
| Bio+MedVis Challenge 2026 | https://gitlab.fi.muni.cz/visitlab/bio-medvis-challenge-2026/ | Preprocessed text files for the dashboard |

## Systems

| ID | Folder (raw MD) | Folder (processed txt) | Description |
|---|---|---|---|
| `zsab2` | `ZS-ab2/` | `zsab2_-_data/` | Free Aβ42 |
| `zsab3` | `ZS-ab3/` | `zsab3_-_data/` | Aβ42 + TMP |
| `zsab4` | `ZS-ab4/` | `zsab4_-_data/` | Aβ42 + SPA |

Local copies in this repo:

```
trajectories/
  ZS-ab2/  ZS-ab3/  ZS-ab4/          # raw .pdb + .xtc
  zsab2_-_data/  zsab3_-_data/  zsab4_-_data/

public/data/
  zsab2/  zsab3/  zsab4/            # txt files loaded by the dashboard
```

---

## 1. CoVAMPnet data (`covampnet_data/`)

Download: [covampnet_data.tar.gz](https://data.ciirc.cvut.cz/public/projects/2023CoVAMPnet/covampnet_data.tar.gz) (~17 GB)

```
covampnet_data/
├── trajectories/              # MD simulations (3D coordinates over time)
│   ├── ZS-ab2/                # simulated system: free Aβ42
│   │   ├── e1s1_0/            # epoch 1, simulation 1 (fresh start at frame 0)
│   │   │   └── output.filtered.xtc   # compressed trajectory frames
│   │   ├── e1s2_0/            # epoch 1, simulation 2
│   │   │   └── output.filtered.xtc
│   │   ├── ...                # ~300+ simulation folders per system
│   │   └── filtered.pdb       # topology: atom/residue identity (one per system)
│   ├── ZS-ab3/                # Aβ42 + tramiprosate (TMP)
│   └── ZS-ab4/                # Aβ42 + 3-sulfopropanoic acid (SPA)
├── models/                    # trained VAMPnet / MSM neural network weights
│   ├── ZS-ab2/
│   ├── ZS-ab3/
│   └── ZS-ab4/
├── model_outputs/             # per-frame MSM probabilities, Koopman matrices, timescales
├── trained_model_histories/   # training/validation loss curves
├── frames_for_gradient_evaluation/  # frame IDs for gradient analysis reproduction
├── training_splits/           # train/val splits for model reproduction
└── training_seeds/            # random seeds for model reproduction
```

### One line per file / folder

| Path | One-line description |
|---|---|
| `trajectories/ZS-abX/filtered.pdb` | Static 3D structure of the molecule (636 atoms, 42 residues); defines topology for all trajectories in that system. |
| `trajectories/ZS-abX/eNsM_0/output.filtered.xtc` | Fresh simulation: epoch N, simulation M, starting at frame 0. |
| `trajectories/ZS-abX/eNsM_eAeBp0fF/output.filtered.xtc` | Chained simulation: continues from frame F of epoch A, simulation B. |
| `output.filtered.xtc` | Binary trajectory: x,y,z coordinates for every atom on every frame (needs `.pdb` for atom names). |
| `models/ZS-abX/` | Saved neural network weights used to build the Markov state model. |
| `model_outputs/` | MSM analysis results: state probabilities, Koopman matrices, implied timescales, equilibrium distributions. |
| `trained_model_histories/` | Loss curves from model training. |
| `frames_for_gradient_evaluation/` | Frame indices used in interpretability / gradient analysis. |
| `training_splits/` | Which frames were used for training vs. validation. |
| `training_seeds/` | Random seeds for reproducible model training. |

### Simulation folder naming

```
e10s12_e1s4p0f1673
 │  │    │  │     └── start frame 1673 in the parent simulation
 │  │    │  └──────── parent simulation 4
 │  │    └─────────── parent epoch 1 ("seed")
 │  └──────────────── simulation 12 in current epoch
 └─────────────────── epoch 10
```

Fresh starts use `_0` suffix, e.g. `e1s1_0` = epoch 1, simulation 1, frame 0.

---

## 2. Bio+MedVis challenge data (`zsabX_-_data/`)

Source: https://gitlab.fi.muni.cz/visitlab/bio-medvis-challenge-2026/

Six text files per system. Copy into `public/data/zsabX/` for the dashboard.

### One line per file

| File | One-line description |
|---|---|
| `zsabX_names.txt` | All trajectory names, sorted alphabetically. |
| `zsabX_order.txt` | Trajectory names sorted by simulation start time (for timeline X position). |
| `zsabX_concatenated.txt` | Chained multi-segment paths, sorted by start time of the last segment. |
| `zsabX_states2.txt` | Per-frame Markov state assignment using a 2-state model. |
| `zsabX_states3.txt` | Per-frame Markov state assignment using a 3-state model. |
| `zsabX_states4.txt` | Per-frame Markov state assignment using a 4-state model. |

### Example lines

**`zsab3_names.txt`** — alphabetical list of trajectories:
```
e10s10_e6s8p0f168
e10s11_e1s4p0f928
e10s12_e1s4p0f1673
```
`e10s12_e1s4p0f1673` = simulation 12 in epoch 10, starting at frame 1673 of epoch 1, simulation 4.

**`zsab3_order.txt`** — trajectories sorted by first-frame time:
```
0: e1s20_0
69: e14s3_e1s13p0f68
124: e3s12_e1s16p0f123
```
`69: e14s3_e1s13p0f68` = this trajectory's first frame occurs at global time 69.

**`zsab3_concatenated.txt`** — glued trajectory paths:
```
69+
0-68: e1s13_0
0+: e14s3_e1s13p0f68
```
`69+` = total concatenated length. First 68 frames from `e1s13_0`, then all remaining frames from `e14s3_e1s13p0f68`.

**`zsab3_states3.txt`** — state label per frame:
```
e10s5_e5s11p0f1123: 0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,2,2,2,...
```
Frame 1–12 → state 0, frame 13 → state 2, frames 14–16 → state 0, frames 17–19 → state 2, etc.

---

## How the two datasets relate

```
CoVAMPnet (raw)                    Bio+MedVis (processed)
─────────────────                  ──────────────────────
filtered.pdb          ──┐
                        ├── analysis (CoVAMPnet / PyEMMA)
output.filtered.xtc   ──┘
                              │
                              ▼
                         zsabX_states*.txt   ← Markov state per frame
                         zsabX_order.txt      ← timeline ordering
                         zsabX_concatenated.txt ← chained paths
                         zsabX_names.txt      ← trajectory index
                              │
                              ▼
                         Dashboard (this app)  ← timeline & matrix charts
                              │
filtered.pdb + .xtc  ─────────┘
                              ▼
                         VMD / MDAnalysis       ← 3D molecular visualization
```

- **Dashboard** reads only the `.txt` files from `public/data/`.
- **3D viewers** need `filtered.pdb` + `output.filtered.xtc` from `trajectories/ZS-abX/`.
- Trajectory names are identical across both datasets (e.g. `e1s1_0`).





File	Contains	Used for
filtered.pdb
molecule identity + one static structure
topology for 3D viewers
output.filtered.xtc
atom positions over time
3D animation & structural analysis
states*.txt
Markov state per frame
dashboard timeline charts
order.txt
simulation start times
dashboard X-axis ordering
concatenated.txt
chained simulation paths
dashboard concatenated view