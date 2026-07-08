#!/usr/bin/env python3
"""
Compute per-frame structural features for ALL trajectories of one system.

Key change vs structural_trajectory_features.py:
- Residue-residue "contact" is defined by a *pair-specific threshold*:
    contact(i,j,frame) = (d(i,j,frame) <= mean_d(i,j) over all frames/trajectories in this system run)
- This avoids using a fixed cutoff like 6 Å for residue-residue contacts.

Outputs the same CSV schema as frame_structural_features.csv:
system, trajectory_name, local_frame, xtc_frame_index, rmsd, radius_of_gyration, contact_features, ligand_contact_features
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Iterable

import numpy as np

try:
    import MDAnalysis as mda
    from MDAnalysis.analysis.rms import rmsd as calc_rmsd
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

# Ligand contacts still use a fixed cutoff.
LIGAND_CUTOFF = 6.0
KEY_PAIRS = [(1, 42), (1, 28), (17, 42), (11, 42), (18, 42)]


def read_names_file(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf8").splitlines() if line.strip()]


def resid_index_map(ca_group) -> dict[int, int]:
    return {int(resid): idx for idx, resid in enumerate(ca_group.resids)}


def pair_distance(positions: np.ndarray, resid_map: dict[int, int], a: int, b: int) -> float | None:
    ia = resid_map.get(a)
    ib = resid_map.get(b)
    if ia is None or ib is None:
        return None
    return float(np.linalg.norm(positions[ia] - positions[ib]))


def ligand_contact_features(protein_ca, ligand_atoms, ca_positions: np.ndarray) -> dict:
    if ligand_atoms is None or len(ligand_atoms) == 0:
        return {"contacts": []}

    ligand_pos = ligand_atoms.positions
    dist = distance_array(ca_positions, ligand_pos)
    min_dist = dist.min(axis=1)
    contacts = []

    for idx, resid in enumerate(protein_ca.resids.astype(int)):
        d = float(min_dist[idx])
        if d <= LIGAND_CUTOFF:
            contacts.append({"resid": int(resid), "d": round(d, 3)})

    return {"contacts": contacts}


def iter_trajectories(system_id: str, trajectory_names: Iterable[str]):
    folder = SYSTEM_FOLDERS.get(system_id)
    if not folder:
        raise ValueError(f"unknown system {system_id}")

    pdb_path = TRAJ_ROOT / folder / "filtered.pdb"
    if not pdb_path.is_file():
        raise FileNotFoundError(f"missing PDB for {system_id}: {pdb_path}")

    for name in trajectory_names:
        xtc_path = TRAJ_ROOT / folder / name / "output.filtered.xtc"
        if not xtc_path.is_file():
            raise FileNotFoundError(f"missing XTC for {system_id}/{name}: {xtc_path}")
        yield name, pdb_path, xtc_path


def compute_pair_mean_thresholds(system_id: str, trajectory_names: list[str]) -> tuple[np.ndarray, np.ndarray]:
    # Accumulate sum/count for each pair in a 42x42 matrix (float64 for stability)
    # We'll only use upper triangle (i<j), but store symmetrically for simplicity.
    sum_mat = np.zeros((42, 42), dtype=np.float64)
    cnt_mat = np.zeros((42, 42), dtype=np.int64)

    for traj_name, pdb_path, xtc_path in iter_trajectories(system_id, trajectory_names):
        u = mda.Universe(str(pdb_path), str(xtc_path))
        ca = u.select_atoms("protein and name CA")
        if len(ca) != 42:
            raise ValueError(f"{system_id}/{traj_name}: expected 42 CA atoms, got {len(ca)}")

        for _ts in u.trajectory:
            dist = distance_array(ca.positions, ca.positions)  # (42,42)
            # accumulate only i<j
            iu = np.triu_indices(42, k=1)
            sum_mat[iu] += dist[iu]
            cnt_mat[iu] += 1

    # Build mean matrix; keep diagonal as 0
    mean_mat = np.zeros((42, 42), dtype=np.float64)
    iu = np.triu_indices(42, k=1)
    mean_mat[iu] = sum_mat[iu] / np.maximum(cnt_mat[iu], 1)
    mean_mat[(iu[1], iu[0])] = mean_mat[iu]  # symmetric

    return mean_mat, cnt_mat


def contact_features_by_mean(ca_group, positions: np.ndarray, mean_thresholds: np.ndarray) -> dict:
    resids = ca_group.resids.astype(int)
    dist = distance_array(positions, positions)
    contacts = []
    n = len(resids)
    resid_map = resid_index_map(ca_group)

    for i in range(n):
        for j in range(i + 1, n):
            d = float(dist[i, j])
            # contact is defined by pair-specific mean threshold
            if d <= float(mean_thresholds[i, j]):
                contacts.append([int(resids[i]), int(resids[j]), round(d, 3)])

    key_distances = {}
    for a, b in KEY_PAIRS:
        d = pair_distance(positions, resid_map, a, b)
        if d is not None:
            key_distances[f"{a}-{b}"] = round(d, 3)

    return {"contacts": contacts, "key_distances": key_distances}


def write_features_csv(
    system_id: str,
    trajectory_names: list[str],
    out_path: Path,
    write_header: bool,
    mean_thresholds: np.ndarray,
):
    fieldnames = [
        "system",
        "trajectory_name",
        "local_frame",
        "xtc_frame_index",
        "rmsd",
        "radius_of_gyration",
        "contact_features",
        "ligand_contact_features",
    ]

    mode = "w" if write_header else "a"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open(mode, newline="", encoding="utf8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()

        folder = SYSTEM_FOLDERS[system_id]
        pdb_path = TRAJ_ROOT / folder / "filtered.pdb"

        for traj_name in trajectory_names:
            xtc_path = TRAJ_ROOT / folder / traj_name / "output.filtered.xtc"
            u = mda.Universe(str(pdb_path), str(xtc_path))
            ca = u.select_atoms("protein and name CA")
            ligand = u.select_atoms("resname MOL or segid L")
            if len(ca) != 42:
                raise ValueError(f"{system_id}/{traj_name}: expected 42 CA atoms, got {len(ca)}")

            u.trajectory[0]
            ref_coords = ca.positions.copy()

            for frame_idx, _ts in enumerate(u.trajectory):
                mobile_coords = ca.positions.copy()
                rmsd_val = float(
                    calc_rmsd(
                        ref_coords,
                        mobile_coords,
                        center=True,
                        superposition=True,
                    )
                )
                rg = float(ca.radius_of_gyration())
                contacts = contact_features_by_mean(ca, ca.positions, mean_thresholds)
                ligand_contacts = ligand_contact_features(ca, ligand, ca.positions)

                writer.writerow(
                    {
                        "system": system_id,
                        "trajectory_name": traj_name,
                        "local_frame": frame_idx,
                        "xtc_frame_index": frame_idx,
                        "rmsd": round(rmsd_val, 4),
                        "radius_of_gyration": round(rg, 4),
                        "contact_features": json.dumps(contacts, separators=(",", ":")),
                        "ligand_contact_features": json.dumps(ligand_contacts, separators=(",", ":")),
                    }
                )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("system_id")
    parser.add_argument("--names-file", required=True, help="Path to <system>_names.txt")
    parser.add_argument("--output", required=True, help="CSV path to write/append")
    parser.add_argument("--write-header", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of trajectories (debug)")
    args = parser.parse_args()

    names_file = Path(args.names_file)
    out_path = Path(args.output)

    traj_names = read_names_file(names_file)
    if args.limit is not None:
        traj_names = traj_names[: args.limit]

    # Pass 1: compute mean thresholds per pair
    print(f"{args.system_id}: computing pair mean thresholds…", file=sys.stderr)
    mean_thresholds, _ = compute_pair_mean_thresholds(args.system_id, traj_names)

    # Pass 2: write per-frame features using mean thresholds
    print(f"{args.system_id}: writing per-frame features…", file=sys.stderr)
    write_features_csv(
        args.system_id,
        traj_names,
        out_path,
        write_header=args.write_header,
        mean_thresholds=mean_thresholds,
    )

    print(f"{args.system_id}: done ({len(traj_names)} trajectories)", file=sys.stderr)


if __name__ == "__main__":
    main()

