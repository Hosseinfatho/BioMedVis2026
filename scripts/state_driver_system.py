#!/usr/bin/env python3
"""
Build per-state heavy-atom interaction stats for StateDriver (TMP vs SPA).

For each residue pair with sequence separation >= 3:
  - minimum heavy-atom distance per frame
  - mean / std distance, median reference d0, mean soft-contact score

For each residue vs ligand:
  - minimum heavy-atom distance to ligand per frame

Output: state_driver_interactions.json group keys
  <system>|<model>|original|<state>
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

try:
    import MDAnalysis as mda
    from MDAnalysis.lib.distances import distance_array
except ImportError:
    print("MDAnalysis required", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
TRAJ_ROOT = ROOT / "trajectories"

SYSTEM_FOLDERS = {
    "zsab2": "ZS-ab2",
    "zsab3": "ZS-ab3",
    "zsab4": "ZS-ab4",
}

HEAVY_SEL = "not name H*"
LIGAND_SEL = "resname MOL or segid L"
MIN_SEQ_SEP = 3
BIN_WIDTH = 0.1
MAX_DISTANCE = 40.0
BETA = 5.0
LAMBDA = 1.8
N_RESIDUES = 42


def read_names_file(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf8").splitlines() if line.strip()]


def load_state_map(
    frame_index_path: Path, system_id: str, trajectory_names: set[str]
) -> dict[str, dict[str, list[int | None]]]:
    state_map: dict[str, dict[str, list[int | None]]] = defaultdict(dict)

    with frame_index_path.open(newline="", encoding="utf8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row["system"] != system_id or row["trajectory_type"] != "original":
                continue
            traj_name = row["trajectory_name"]
            if traj_name not in trajectory_names:
                continue

            model = row["model"]
            frame_idx = int(row["local_frame"])
            state = int(row["state"])

            slots = state_map[model].setdefault(traj_name, [])
            if frame_idx >= len(slots):
                slots.extend([None] * (frame_idx + 1 - len(slots)))
            slots[frame_idx] = state

    return state_map


def pair_keys_with_sep(min_sep: int = MIN_SEQ_SEP) -> list[tuple[int, int, str]]:
    pairs: list[tuple[int, int, str]] = []
    for i in range(N_RESIDUES):
        for j in range(i + min_sep, N_RESIDUES):
            pairs.append((i, j, f"{i + 1}-{j + 1}"))
    return pairs


def hist_index(distance: float, n_bins: int) -> int:
    idx = int(distance // BIN_WIDTH)
    return max(0, min(n_bins - 1, idx))


def stats_and_soft_from_hist(counts: np.ndarray) -> dict | None:
    total = int(counts.sum())
    if total <= 0:
        return None

    centers = (np.arange(len(counts), dtype=np.float64) + 0.5) * BIN_WIDTH
    counts_f = counts.astype(np.float64)
    mean_d = float(np.dot(centers, counts_f) / total)
    var_d = float(np.dot((centers - mean_d) ** 2, counts_f) / total)
    std_d = float(np.sqrt(max(var_d, 0.0)))

    cum = np.cumsum(counts)
    med_idx = int(np.searchsorted(cum, total / 2.0))
    d0 = (med_idx + 0.5) * BIN_WIDTH

    soft_vals = 1.0 / (1.0 + np.exp(BETA * (centers - LAMBDA * d0)))
    mean_soft = float(np.dot(soft_vals, counts_f) / total)
    var_soft = float(np.dot((soft_vals - mean_soft) ** 2, counts_f) / total)
    std_soft = float(np.sqrt(max(var_soft, 0.0)))

    return {
        "mean_distance": round(mean_d, 4),
        "distance_std": round(std_d, 4),
        "median_distance": round(d0, 4),
        "mean_soft": round(mean_soft, 4),
        "soft_std": round(std_soft, 4),
        "persistence": round(1.0 / (1.0 + std_d), 4),
    }


def build_state_driver_interactions(
    system_id: str,
    names_file: Path,
    frame_index_path: Path,
) -> dict:
    if system_id not in SYSTEM_FOLDERS:
        raise ValueError(f"unknown system {system_id}")

    n_bins = int(round(MAX_DISTANCE / BIN_WIDTH))
    pair_list = pair_keys_with_sep()
    pair_count = len(pair_list)

    traj_names = read_names_file(names_file)
    state_map = load_state_map(frame_index_path, system_id, set(traj_names))

    folder = SYSTEM_FOLDERS[system_id]
    pdb_path = TRAJ_ROOT / folder / "filtered.pdb"

    pair_hist: dict[str, np.ndarray] = {}
    ligand_hist: dict[str, np.ndarray] = {}
    group_frames: dict[str, int] = defaultdict(int)

    for traj_name in traj_names:
        xtc_path = TRAJ_ROOT / folder / traj_name / "output.filtered.xtc"
        if not xtc_path.exists():
            continue

        universe = mda.Universe(str(pdb_path), str(xtc_path))
        protein = universe.select_atoms("protein")
        residues = protein.residues[:N_RESIDUES]
        if len(residues) != N_RESIDUES:
            raise ValueError(f"{system_id}/{traj_name}: expected {N_RESIDUES} residues, got {len(residues)}")

        heavy_by_res = [res.atoms.select_atoms(HEAVY_SEL) for res in residues]
        ligand = universe.select_atoms(LIGAND_SEL)

        model_states = {
            model: per_traj[traj_name]
            for model, per_traj in state_map.items()
            if traj_name in per_traj
        }
        if not model_states:
            continue

        for frame_idx, _ts in enumerate(universe.trajectory):
            heavy_pos = [grp.positions for grp in heavy_by_res]
            ligand_pos = ligand.positions if len(ligand) else None

            pair_distances: list[float] = []
            for i, j, _key in pair_list:
                if len(heavy_pos[i]) == 0 or len(heavy_pos[j]) == 0:
                    pair_distances.append(MAX_DISTANCE)
                else:
                    pair_distances.append(float(distance_array(heavy_pos[i], heavy_pos[j]).min()))

            ligand_distances: list[float] = []
            for i in range(N_RESIDUES):
                if ligand_pos is None or len(ligand_pos) == 0 or len(heavy_pos[i]) == 0:
                    ligand_distances.append(MAX_DISTANCE)
                else:
                    ligand_distances.append(float(distance_array(heavy_pos[i], ligand_pos).min()))

            for model, states in model_states.items():
                if frame_idx >= len(states):
                    continue
                state = states[frame_idx]
                if state is None:
                    continue

                group_key = f"{system_id}|{model}|original|{state}"
                if group_key not in pair_hist:
                    pair_hist[group_key] = np.zeros((pair_count, n_bins), dtype=np.uint32)
                    ligand_hist[group_key] = np.zeros((N_RESIDUES, n_bins), dtype=np.uint32)

                for pidx, dist in enumerate(pair_distances):
                    b = hist_index(dist, n_bins)
                    pair_hist[group_key][pidx, b] += 1

                for ridx, dist in enumerate(ligand_distances):
                    b = hist_index(dist, n_bins)
                    ligand_hist[group_key][ridx, b] += 1

                group_frames[group_key] += 1

    output: dict = {
        "_meta": {
            "format": "state_driver_v1",
            "bin_width": BIN_WIDTH,
            "max_distance": MAX_DISTANCE,
            "beta": BETA,
            "lambda": LAMBDA,
            "min_seq_sep": MIN_SEQ_SEP,
            "systems": {"TMP": "zsab3", "SPA": "zsab4"},
            "description": "Heavy-atom min-distance interaction stats with soft-contact scores",
        }
    }

    for group_key, counts in pair_hist.items():
        pairs: dict[str, dict] = {}
        for pidx, (_i, _j, pair_key) in enumerate(pair_list):
            stats = stats_and_soft_from_hist(counts[pidx])
            if stats:
                pairs[pair_key] = stats

        ligand: dict[str, dict] = {}
        for ridx in range(N_RESIDUES):
            stats = stats_and_soft_from_hist(ligand_hist[group_key][ridx])
            if stats:
                ligand[str(ridx + 1)] = stats

        output[group_key] = {
            "total_frames": int(group_frames[group_key]),
            "pairs": pairs,
            "ligand": ligand,
        }

    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("system_id")
    parser.add_argument("--names-file", required=True)
    parser.add_argument("--frame-index", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    result = build_state_driver_interactions(
        system_id=args.system_id,
        names_file=Path(args.names_file),
        frame_index_path=Path(args.frame_index),
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result), encoding="utf8")
    group_count = sum(1 for key in result if key != "_meta")
    print(f"{args.system_id}: wrote {group_count} groups", file=sys.stderr)


if __name__ == "__main__":
    main()
