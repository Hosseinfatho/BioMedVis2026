## Analysis of conformational states in adaptive molecular dynamics simulations
Challenge 1: This challenge is focused on adaptive molecular dynamics simulation data, which is used to explore how biomolecules change their structure and interact with other molecules over time. These simulations can reveal important changes and are essential to drug design. However, they generate large and abstract datasets that make it difficult to explore the changes, compare trajectories, or reason about molecular behavior across entire ensembles.

## More info http://biovis.net/2026/biovisChallenges_vis/challenge_1/
## Systems

| ID | Description |
|---|---|
| `zsab2` | Free Aβ42 |
| `zsab3` | Aβ42 + TMP |
| `zsab4` | Aβ42 + SPA |

## Requirements

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- npm

## Data setup

Trajectory and state files are **not** stored in git (see `.gitignore`). Copy the preprocessed text files into:

```
public/data/
  zsab2/   (zsab2_states2.txt, states3, states4, order.txt, concatenated.txt, …)
  zsab3/
  zsab4/
```

You can obtain them from the [BioMedvis challenge data repository](https://gitlab.fi.muni.cz/visitlab/bio-medvis-challenge-2026/) or from the CoVAMPnet release under `trajectories/zsabX_-_data/`.

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Production build:

```bash
npm run build
npm run preview
```

## Using the dashboard

1. **System selection** — choose one or more systems (`zsab2`, `zsab3`, `zsab4`).
2. **State model** — `2-state`, `3-state`, or `4-state` MSM (applies to all selected systems on the right panel).
3. **Trajectory view**
   - **Original** (default) — each row is one simulation; horizontal position from `order.txt` (start time); bar length from frame count in the states file; epoch from the simulation name.
   - **Concatenated** — each row is a chained path from `concatenated.txt`; segments are glued end-to-end from frame 0. Paths are sorted by total length (shortest at the bottom) for a clean staircase on the Y axis.
4. Click **Generate** to load and draw the charts.

### Compare section

Below the per-system charts, **Compare** lets you pick two systems and inspect ratio matrices side by side.

- **System A / B** — select systems, then click **Compare** to show B and a **Difference** matrix (`|A − B|`, empty when identical).
- **Ratio matrix** — rows = Markov states then directed transitions; columns = trajectories (union of slots, matched by prefix before `_`).
- **State cells** — occupancy ratio with state color; **transition cells** — rate ratio with source/target colors.
- **Interactive brush** — drag on matrix columns to select a trajectory window; selection syncs to epoch/state charts above.
- **Rate** — N×N heatmap of state (diagonal) and transition (off-diagonal) percentages for the brushed window.

Matrices use the same view mode (Original / Concatenated) and state model as the controls above.

## Project layout

```
src/
  App.jsx                      # load data, orchestrate views
  components/
    ControlPanel.jsx           # systems, state model, view mode, Generate
    TrajectoryRows.jsx         # left: epoch timeline + inline legend
    State.jsx                  # right: Markov states + inline legend
    comparison/
      Comparison.jsx           # per-system chart blocks
      ComparisonRow.jsx
      ComparisonHeader.jsx
    compare/
      Compare.jsx              # system A/B picker + difference
      InteractiveMatrix.jsx    # brush + ratio matrix
      RateMatrix.jsx           # N×N percentage heatmap
      RatioMatrix.jsx          # canvas ratio matrix
      glyphs.js, layout.js
  config/dataFiles.js          # paths and system metadata
  utils/                       # parsers, feature extraction, chart layout
public/data/                   # state/order/concatenated files (local only)
```

## References

[1] Scherer, M. K., Trendelkamp-Schroer, B., Paul, F., Pérez-Hernández, G., Hoffmann, M., Plattner, N., … & Noé, F. (2015). PyEMMA 2: A software package for estimation, validation, and analysis of Markov models. Journal of chemical theory and computation, 11(11), 5525-5542. https://doi.org/10.1021/acs.jctc.5b00743

[2] Marques, Sérgio M., et al. CoVAMPnet: comparative Markov state analysis for studying effects of drug candidates on disordered biomolecules. JACS Au, 2024, 4.6: 2228-2245. https://doi.org/10.1021/jacsau.4c00182

[3] Mardt, A.; Pasquali, L.; Wu, H.; Noé, F. VAMPnets for Deep Learning of Molecular Kinetics. Nat. Commun 2018, 9 (1), 5. https://doi.org/10.1038/s41467-017-02388-1

[4] Ulbrich, P., Waldner, M., Furmanová, K., Marques, S. M., Bednář, D., Kozlíková, B., & Byška, J. (2022). sMolBoxes: Dataflow model for molecular dynamics exploration. IEEE Transactions on Visualization and Computer Graphics, 29(1), 581-590. https://doi.org/10.1109/TVCG.2022.3209411

[5] Belghit, Hayet, Mariano Spivak, Manuel Dauchez, Marc Baaden, and Jessica Jonquet-Prevoteau. “From complex data to clear insights: visualizing molecular dynamics trajectories.” Frontiers in Bioinformatics 4 (2024): 1356659. https://doi.org/10.1016/j.jmb.2018.09.004

[6] Kozlíková, B., Krone, M., Falk, M., Lindow, N., Baaden, M., Baum, D., … & Hege, H. C. (2017, December). Visualization of biomolecular structures: State of the art revisited. In Computer Graphics Forum (Vol. 36, No. 8, pp. 178-204). https://doi.org/10.1111/cgf.13072
