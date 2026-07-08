#!/usr/bin/env python3
"""
Build per-state residue-pair Cα–Cα distance histograms for one system.

Every frame in each Markov state contributes one real distance per pair (i,j).
Distances are stored as fixed-width histograms so the UI can count frames
below any threshold without re-running preprocess.

Output JSON structure:
{
  "_meta": {
    "format": "distance_histogram_v2",
    "bin_width": 0.1,
    "max_distance": 40.0,
    "n_bins": 400,
    "description": "Per-pair distance histograms with mean/std for state-wise stability scoring"
  },
  "<system>|<model>|original|<state>": {
    "total_frames": 171665,
    "pair_hist": { "1-2": [0, 0, ...], ... },
    "pair_stats": { "1-2": {"mean": 3.82, "std": 0.12, "n": 171665}, ... }
  }
}
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

DEFAULT_BIN_WIDTH = 0.1
DEFAULT_MAX_DISTANCE = 40.0


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


def distance_hist_indices(distances: np.ndarray, bin_width: float, n_bins: int) -> np.ndarray:
    idx = np.floor(distances / bin_width).astype(np.int32)
    np.clip(idx, 0, n_bins - 1, out=idx)
    return idx


def stats_from_hist(row: np.ndarray, bin_width: float) -> tuple[float, float, int]:
    total = int(row.sum())
    if total <= 0:
        return 0.0, 0.0, 0
    centers = (np.arange(len(row), dtype=np.float64) + 0.5) * bin_width
    row_f = row.astype(np.float64)
    mean = float(np.dot(centers, row_f) / total)
    var = float(np.dot((centers - mean) ** 2, row_f) / total)
    std = float(np.sqrt(max(var, 0.0)))
    return mean, std, total


def build_signature_residuals(
    system_id: str,
    names_file: Path,
    frame_index_path: Path,
    bin_width: float = DEFAULT_BIN_WIDTH,
    max_distance: float = DEFAULT_MAX_DISTANCE,
) -> dict:
    n_bins = int(round(max_distance / bin_width))
    if n_bins <= 0:
        raise ValueError("max_distance must be greater than bin_width")

    traj_names = read_names_file(names_file)
    if not traj_names:
        return {
            "_meta": {
                "format": "distance_histogram_v2",
                "bin_width": bin_width,
                "max_distance": max_distance,
                "n_bins": n_bins,
                "description": "Per-pair distance histograms with mean/std for state-wise stability scoring",
            }
        }

    state_map = load_state_map(frame_index_path, system_id, set(traj_names))

    folder = SYSTEM_FOLDERS[system_id]
    pdb_path = TRAJ_ROOT / folder / "filtered.pdb"
    pair_i, pair_j = np.triu_indices(42, k=1)
    pair_keys = [f"{int(i) + 1}-{int(j) + 1}" for i, j in zip(pair_i, pair_j)]
    pair_count = len(pair_keys)
    pair_idx = np.arange(pair_count)

    group_hist: dict[str, np.ndarray] = {}
    group_frames: dict[str, int] = defaultdict(int)

    for traj_name in traj_names:
        xtc_path = TRAJ_ROOT / folder / traj_name / "output.filtered.xtc"
        if not xtc_path.exists():
            continue

        universe = mda.Universe(str(pdb_path), str(xtc_path))
        ca = universe.select_atoms("protein and name CA")
        if len(ca) != 42:
            raise ValueError(f"{system_id}/{traj_name}: expected 42 CA atoms, got {len(ca)}")

        model_states = {
            model: per_traj[traj_name]
            for model, per_traj in state_map.items()
            if traj_name in per_traj
        }
        if not model_states:
            continue

        for frame_idx, _ts in enumerate(universe.trajectory):
            coords = ca.positions
            distances = np.linalg.norm(coords[pair_i] - coords[pair_j], axis=1)
            hist_idx = distance_hist_indices(distances, bin_width, n_bins)

            for model, states in model_states.items():
                if frame_idx >= len(states):
                    continue
                state = states[frame_idx]
                if state is None:
                    continue

                group_key = f"{system_id}|{model}|original|{state}"
                if group_key not in group_hist:
                    group_hist[group_key] = np.zeros((pair_count, n_bins), dtype=np.uint32)
                np.add.at(group_hist[group_key], (pair_idx, hist_idx), 1)
                group_frames[group_key] += 1

    output: dict = {
        "_meta": {
            "format": "distance_histogram_v2",
            "bin_width": bin_width,
            "max_distance": max_distance,
            "n_bins": n_bins,
            "description": "Per-pair distance histograms with mean/std for state-wise stability scoring",
        }
    }

    for group_key, counts in group_hist.items():
        pair_hist: dict[str, list[int]] = {}
        pair_stats: dict[str, dict[str, float | int]] = {}
        for idx, pair_key in enumerate(pair_keys):
            row = counts[idx]
            total = int(row.sum())
            if total <= 0:
                continue
            mean, std, _n = stats_from_hist(row, bin_width)
            pair_hist[pair_key] = [int(v) for v in row.tolist()]
            pair_stats[pair_key] = {
                "mean": round(mean, 4),
                "std": round(std, 4),
                "n": total,
            }

        output[group_key] = {
            "total_frames": int(group_frames[group_key]),
            "pair_hist": pair_hist,
            "pair_stats": pair_stats,
        }

    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("system_id")
    parser.add_argument("--names-file", required=True)
    parser.add_argument("--frame-index", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--bin-width", type=float, default=DEFAULT_BIN_WIDTH)
    parser.add_argument("--max-distance", type=float, default=DEFAULT_MAX_DISTANCE)
    args = parser.parse_args()

    result = build_signature_residuals(
        system_id=args.system_id,
        names_file=Path(args.names_file),
        frame_index_path=Path(args.frame_index),
        bin_width=args.bin_width,
        max_distance=args.max_distance,
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result), encoding="utf8")
    group_count = sum(1 for key in result if key != "_meta")
    print(f"{args.system_id}: wrote {group_count} groups", file=sys.stderr)


if __name__ == "__main__":
    main()
