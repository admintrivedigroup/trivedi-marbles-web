"""
Perspective / homography utilities — port of src/lib/visualizer/perspective.ts.

Uses cv2.findHomography (per the user's brief) instead of the hand-rolled
Gauss-Jordan solve in the TS original — same 4-point exact-fit homography,
solved with OpenCV's optimized DLT implementation.
"""

from __future__ import annotations

import cv2
import numpy as np

Quad = np.ndarray  # shape (4, 2), float32, [TL, TR, BR, BL]


def compute_homography(src: Quad, dst: Quad) -> np.ndarray | None:
    H, _ = cv2.findHomography(
        np.asarray(src, dtype=np.float32), np.asarray(dst, dtype=np.float32), method=0
    )
    if H is None:
        return None
    return H


def apply_homography_grid(H: np.ndarray, W: int, Hh: int) -> tuple[np.ndarray, np.ndarray]:
    """Vectorized equivalent of applyH(H, x, y) for every pixel.

    Returns (fx, fy) float32 arrays of shape (Hh, W): each image pixel mapped
    through the homography (e.g. floorQuad -> unit-quad floor coordinates).
    """
    xs, ys = np.meshgrid(np.arange(W, dtype=np.float64), np.arange(Hh, dtype=np.float64))
    w = H[2, 0] * xs + H[2, 1] * ys + H[2, 2]
    w = np.where(np.abs(w) < 1e-10, 1e-10, w)
    fx = (H[0, 0] * xs + H[0, 1] * ys + H[0, 2]) / w
    fy = (H[1, 0] * xs + H[1, 1] * ys + H[1, 2]) / w
    return fx.astype(np.float32), fy.astype(np.float32)


def rasterize_quad(quad: Quad, W: int, Hh: int) -> np.ndarray:
    mask = np.zeros((Hh, W), dtype=np.uint8)
    pts = np.round(np.asarray(quad, dtype=np.float64)).astype(np.int32)
    cv2.fillPoly(mask, [pts], 1)
    return mask
