#!/usr/bin/env python3
"""Compute per-frame structural features for one trajectory."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

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

CONTACT_CUTOFF = 6.0
KEY_PAIRS = [(1, 42), (1, 28), (17, 42), (11, 42), (18, 42)]


def resid_index_map(ca_group):
    return {int(resid): idx for idx, resid in enumerate(ca_group.resids)}


def pair_distance(positions, resid_map, a, b):
    ia = resid_map.get(a)
    ib = resid_map.get(b)
    if ia is None or ib is None:
        return None
    return float(np.linalg.norm(positions[ia] - positions[ib]))


def contact_features(ca_group, positions):
    resids = ca_group.resids.astype(int)
    dist = distance_array(positions, positions)
    contacts = []
    n = len(resids)
    resid_map = resid_index_map(ca_group)

    for i in range(n):
        for j in range(i + 1, n):
            d = float(dist[i, j])
            if d <= CONTACT_CUTOFF:
                contacts.append([int(resids[i]), int(resids[j]), round(d, 3)])

    key_distances = {}
    for a, b in KEY_PAIRS:
        d = pair_distance(positions, resid_map, a, b)
        if d is not None:
            key_distances[f"{a}-{b}"] = round(d, 3)

    return {
        "contacts": contacts,
        "key_distances": key_distances,
    }


def ligand_contact_features(protein_ca, ligand_atoms, ca_positions):
    if ligand_atoms is None or len(ligand_atoms) == 0:
        return {"contacts": []}

    ligand_pos = ligand_atoms.positions
    dist = distance_array(ca_positions, ligand_pos)
    min_dist = dist.min(axis=1)
    contacts = []

    for idx, resid in enumerate(protein_ca.resids.astype(int)):
        d = float(min_dist[idx])
        if d <= CONTACT_CUTOFF:
            contacts.append({"resid": int(resid), "d": round(d, 3)})

    return {"contacts": contacts}


def process_trajectory(system_id: str, trajectory_name: str, writer: csv.DictWriter) -> int:
    folder = SYSTEM_FOLDERS.get(system_id)
    if not folder:
        raise ValueError(f"unknown system {system_id}")

    pdb_path = TRAJ_ROOT / folder / "filtered.pdb"
    xtc_path = TRAJ_ROOT / folder / trajectory_name / "output.filtered.xtc"

    if not pdb_path.is_file() or not xtc_path.is_file():
        raise FileNotFoundError(f"missing PDB/XTC for {system_id}/{trajectory_name}")

    u = mda.Universe(str(pdb_path), str(xtc_path))
    ca = u.select_atoms("protein and name CA")
    ligand = u.select_atoms("resname MOL or segid L")

    if len(ca) == 0:
        raise ValueError(f"no CA atoms for {system_id}/{trajectory_name}")

    u.trajectory[0]
    ref_coords = ca.positions.copy()
    resid_map = resid_index_map(ca)

    count = 0
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
        contacts = contact_features(ca, ca.positions)
        ligand_contacts = ligand_contact_features(ca, ligand, ca.positions)

        writer.writerow(
            {
                "system": system_id,
                "trajectory_name": trajectory_name,
                "local_frame": frame_idx,
                "xtc_frame_index": frame_idx,
                "rmsd": round(rmsd_val, 4),
                "radius_of_gyration": round(rg, 4),
                "contact_features": json.dumps(contacts, separators=(",", ":")),
                "ligand_contact_features": json.dumps(ligand_contacts, separators=(",", ":")),
            }
        )
        count += 1

    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("system_id")
    parser.add_argument("trajectory_name")
    parser.add_argument("--output", required=True, help="CSV path to append to")
    parser.add_argument("--write-header", action="store_true")
    args = parser.parse_args()

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

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    mode = "w" if args.write_header else "a"
    with output_path.open(mode, newline="", encoding="utf8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if args.write_header:
            writer.writeheader()

        count = process_trajectory(args.system_id, args.trajectory_name, writer)

    print(f"{args.system_id}/{args.trajectory_name}: {count} frames", file=sys.stderr)


if __name__ == "__main__":
    main()
