"""
Floor-wall boundary detection — port of src/lib/visualizer/floorBoundary.ts
(Phase 4.5 anti-leakage: per-column upper limit on the floor zone, from
depth-derived surface normals).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

NY_THRESHOLD = 0.35
GAP_FRACTION = 0.025
SMOOTH_WIN_FRACTION = 0.06
BOUNDARY_PAD_FRACTION = 0.010


@dataclass
class FloorBoundaryResult:
    boundary_y: np.ndarray  # int32[W], -1 = no floor found
    below_boundary_mask: np.ndarray  # uint8[H, W]


def detect_floor_wall_boundary(normals: np.ndarray) -> FloorBoundaryResult:
    H, W, _ = normals.shape
    gap_tol = max(3, round(H * GAP_FRACTION))
    abs_ny = np.abs(normals[..., 1])

    raw_bound = np.full(W, H - 1, dtype=np.int32)
    for x in range(W):
        top_floor = H - 1
        gap = 0
        for y in range(H - 1, -1, -1):
            if abs_ny[y, x] > NY_THRESHOLD:
                top_floor = y
                gap = 0
            else:
                gap += 1
                if gap > gap_tol:
                    break
        raw_bound[x] = top_floor

    half = max(5, round(W * SMOOTH_WIN_FRACTION))
    smoothed = np.empty(W, dtype=np.int32)
    for x in range(W):
        lo, hi = max(0, x - half), min(W - 1, x + half)
        smoothed[x] = int(np.median(raw_bound[lo : hi + 1]))

    pad = max(4, round(H * BOUNDARY_PAD_FRACTION))
    below_boundary_mask = np.zeros((H, W), dtype=np.uint8)
    for x in range(W):
        limit = max(0, smoothed[x] - pad)
        below_boundary_mask[limit:H, x] = 1

    return FloorBoundaryResult(boundary_y=smoothed, below_boundary_mask=below_boundary_mask)
