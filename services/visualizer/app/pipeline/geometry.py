"""
Floor mask refinement — numpy/OpenCV port of src/lib/visualizer/maskUtils.ts.

Same thresholds and pipeline order as the TS original (validated over several
tuning passes on the existing /inventory visualizer). OpenCV primitives replace
the browser Canvas 2D calls where they do the same job (GaussianBlur instead of
CSS blur, connectedComponents/floodFill instead of manual BFS, distanceTransform
instead of the windowed feather search).
"""

from __future__ import annotations

import math

import cv2
import numpy as np

Mask = np.ndarray  # dtype uint8, shape (H, W), values {0, 1}

# Cross-shaped structuring element: matches erode1px's "all 4 orthogonal
# neighbours must be floor" rule (no diagonals).
_PLUS_KERNEL = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=np.uint8)


def extract_binary_mask(mask_rgba: np.ndarray) -> Mask:
    """alpha < 128 => floor (1), matching the SAM mask convention (alpha=0=floor)."""
    return (mask_rgba[..., 3] < 128).astype(np.uint8)


def _fill_holes_in_mask(binary: Mask) -> Mask:
    alpha = np.where(binary == 1, 0, 255).astype(np.uint8)
    blurred = cv2.GaussianBlur(alpha, (0, 0), sigmaX=4.0)
    return (blurred < 80).astype(np.uint8)


def keep_bottom_connected_floor(mask: Mask) -> Mask:
    """BFS-equivalent: keep only the component touching the bottom 5% of rows."""
    H, W = mask.shape
    seed_y = max(0, H - math.ceil(H * 0.05))

    num_labels, labels = cv2.connectedComponents(mask.astype(np.uint8), connectivity=4)
    if num_labels <= 1:
        return np.zeros((H, W), dtype=np.uint8)

    seed_region = labels[seed_y:H, :]
    seed_mask_region = mask[seed_y:H, :]
    seed_labels = np.unique(seed_region[seed_mask_region == 1])
    seed_labels = seed_labels[seed_labels != 0]

    if seed_labels.size == 0:
        return np.zeros((H, W), dtype=np.uint8)

    return np.isin(labels, seed_labels).astype(np.uint8)


def refine_floor_mask(raw_binary: Mask) -> Mask:
    H, W = raw_binary.shape
    filled = _fill_holes_in_mask(raw_binary)
    horizon_y = round(H * 0.40)
    clipped = filled.copy()
    clipped[:horizon_y, :] = 0
    return keep_bottom_connected_floor(clipped)


def erode_n_px(mask: Mask, n: int) -> Mask:
    if n <= 0:
        return mask
    return cv2.erode(mask, _PLUS_KERNEL, iterations=n, borderType=cv2.BORDER_CONSTANT, borderValue=0)


def erode_1px(mask: Mask) -> Mask:
    return erode_n_px(mask, 1)


def flood_fill_from_point(mask: Mask, seed_x: int, seed_y: int) -> Mask:
    H, W = mask.shape
    if not (0 <= seed_x < W and 0 <= seed_y < H) or mask[seed_y, seed_x] != 1:
        return np.zeros((H, W), dtype=np.uint8)

    work = mask.astype(np.uint8).copy()
    flood_mask = np.zeros((H + 2, W + 2), dtype=np.uint8)
    cv2.floodFill(work, flood_mask, (seed_x, seed_y), 2, loDiff=0, upDiff=0, flags=4)
    return (work == 2).astype(np.uint8)


def largest_connected_component(mask: Mask) -> Mask:
    H, W = mask.shape
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        mask.astype(np.uint8), connectivity=4
    )
    if num_labels <= 1:
        return np.zeros((H, W), dtype=np.uint8)

    areas = stats[1:, cv2.CC_STAT_AREA]
    best_label = 1 + int(np.argmax(areas))
    return (labels == best_label).astype(np.uint8)


def mask_coverage(mask: Mask) -> float:
    if mask.size == 0:
        return 0.0
    return float(np.mean(mask))


def extract_floor_luminance(orig_rgb: np.ndarray, floor_mask: Mask) -> np.ndarray:
    r = orig_rgb[..., 0].astype(np.float32)
    g = orig_rgb[..., 1].astype(np.float32)
    b = orig_rgb[..., 2].astype(np.float32)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return np.where(floor_mask == 1, lum, 0.0).astype(np.float32)


def mean_floor_luminance(lum: np.ndarray, mask: Mask) -> float:
    if not np.any(mask == 1):
        return 128.0
    return float(np.mean(lum[mask == 1]))


def create_feather_mask(mask: Mask, feather_px: int = 2) -> np.ndarray:
    """1.0 = interior, 0.0 = outside mask, in-between = within feather_px of the edge.

    Image boundary counts as non-floor (matches the TS window search), reproduced
    here by zero-padding before the distance transform.
    """
    padded = np.pad((mask * 255).astype(np.uint8), 1, mode="constant", constant_values=0)
    dist = cv2.distanceTransform(padded, cv2.DIST_L2, 5)
    dist = dist[1:-1, 1:-1]
    feather = np.where(mask == 1, np.minimum(dist, feather_px) / feather_px, 0.0)
    return feather.astype(np.float32)
