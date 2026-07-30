"""Surface normal classification — port of src/lib/visualizer/normalUtils.ts."""

from __future__ import annotations

import numpy as np


def build_horizontal_mask(
    normals: np.ndarray,
    sam_floor_mask: np.ndarray,
    dot_threshold: float = 0.50,
) -> tuple[np.ndarray, np.ndarray]:
    """normals: (H, W, 3) float32, unit vectors. Returns (horizontal_mask, vertical_mask)."""
    floor_px = sam_floor_mask == 1
    count = int(floor_px.sum())

    if count >= 20:
        ref = normals[floor_px].mean(axis=0)
        length = float(np.linalg.norm(ref))
        ref = ref / length if length > 0.01 else np.array([0.0, 1.0, 0.0])
    else:
        ref = np.array([0.0, 1.0, 0.0])

    dot = normals @ ref
    horizontal_mask = (dot >= dot_threshold).astype(np.uint8)
    vertical_mask = (dot < 0.15).astype(np.uint8)

    if count >= 20:
        kept = int(np.count_nonzero(floor_px & (horizontal_mask == 1)))
        if kept < count * 0.30:
            horizontal_mask = np.ones_like(horizontal_mask)
            vertical_mask = np.zeros_like(vertical_mask)

    return horizontal_mask, vertical_mask


def build_horizontal_mask_fixed(normals: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    abs_ny = np.abs(normals[..., 1])
    horizontal_mask = (abs_ny > 0.50).astype(np.uint8)
    vertical_mask = (abs_ny < 0.20).astype(np.uint8)
    return horizontal_mask, vertical_mask
