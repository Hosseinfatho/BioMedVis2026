#!/usr/bin/env python3
"""Return atom coordinates (Å) for one XTC frame as JSON on stdout."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    import MDAnalysis as mda
except ImportError:
    print(json.dumps({"error": "MDAnalysis required"}))
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]


def resolve_traj_root() -> Path:
    """Locate the raw trajectory tree (PDB + per-simulation XTC folders).

    Order of resolution:
    1. TRAJ_ROOT env var (absolute or relative to the project root).
    2. Known dataset locations shipped with this repo.
    3. Legacy ``trajectories/`` fallback.
    """
    override = os.environ.get("TRAJ_ROOT")
    if override:
        candidate = Path(override)
        if not candidate.is_absolute():
            candidate = ROOT / candidate
        return candidate

    candidates = [
        ROOT / "trajectories",
        ROOT / "covampnet_data" / "CoVAMPnet_data" / "trajectories",
    ]
    for candidate in candidates:
        if candidate.is_dir() and any(candidate.glob("ZS-ab*/filtered.pdb")):
            return candidate
    return candidates[0]


TRAJ_ROOT = resolve_traj_root()

SYSTEM_FOLDERS = {
    "zsab2": "ZS-ab2",
    "zsab3": "ZS-ab3",
    "zsab4": "ZS-ab4",
}


def main() -> None:
    if len(sys.argv) != 4:
        print(json.dumps({"error": "usage: xtc_frame_coords.py <systemId> <trajectory> <frame>"}))
        sys.exit(1)

    system_id, traj_name, frame_s = sys.argv[1:4]
    frame_index = int(frame_s)
    folder = SYSTEM_FOLDERS.get(system_id)
    if not folder:
        print(json.dumps({"error": f"unknown system {system_id}"}))
        sys.exit(1)

    pdb_path = TRAJ_ROOT / folder / "filtered.pdb"
    xtc_path = TRAJ_ROOT / folder / traj_name / "output.filtered.xtc"

    if not pdb_path.is_file() or not xtc_path.is_file():
        print(json.dumps({"error": "PDB or XTC file missing"}))
        sys.exit(1)

    u = mda.Universe(str(pdb_path), str(xtc_path))
    n_frames = len(u.trajectory)
    if n_frames == 0:
        print(json.dumps({"error": "empty trajectory"}))
        sys.exit(1)

    safe_frame = max(0, min(frame_index, n_frames - 1))
    u.trajectory[safe_frame]
    coords = u.atoms.positions.astype(float).tolist()

    print(
        json.dumps(
            {
                "frame": safe_frame,
                "nFrames": n_frames,
                "nAtoms": len(coords),
                "coords": coords,
            }
        )
    )


if __name__ == "__main__":
    main()
