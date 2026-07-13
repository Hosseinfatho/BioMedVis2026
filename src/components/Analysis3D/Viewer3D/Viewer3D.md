# Viewer3D

First subcomponent of **Analysis3D** — residue-level 3D structure (42 Cα, Aβ42).

- **Controls (top):** Trajectory, Frame, and State (S0/S1/… linked to frame via `trajectoryRows[].states`).
- **Ribbon:** Backbone cartoon, fixed **residue rainbow** (N→C, 3Dmol Sinebow). Does not change with frame.
- **Spheres:** Cα markers colored by **Markov state** at the selected trajectory + frame (`getMarkovStateColor`, same palette as Compare).
- **Right bar:** Residue color scale only — aligned with the ribbon (from `residueSpectrum.js`). No state legend here.
- **Data:** Structure from `trajectories/ZS-abX/filtered.pdb`; trajectory list and states from `public/data/zsabX/`. **Not wired:** `output.filtered.xtc` (geometry still static per frame).

**Files:** `Viewer3D.jsx`, `Viewer3DColorBar.jsx`, `residueSpectrum.js`, `trajectoryConfig.js`
