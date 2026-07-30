"""World-space floor UV mapping — port of src/lib/visualizer/floorUV.ts.

Vectorized over the whole (fx, fy) grid instead of per-pixel, since numpy/cv2
can batch this instead of looping like the browser Canvas implementation did.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

TextureMode = Literal["continuous", "tile", "bookmatch", "bookmatch4"]


@dataclass
class SlabUVParams:
    tiles_across: float
    tiles_deep: float
    mode: TextureMode
    grout_half_u: float
    grout_half_v: float
    cos_r: float
    sin_r: float
    scale_factor: float


def floor_uv(fx: np.ndarray, fy: np.ndarray, p: SlabUVParams) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    dx = (fx - 0.5) / p.scale_factor
    dy = (fy - 0.5) / p.scale_factor
    if p.cos_r != 1 or p.sin_r != 0:
        rx = p.cos_r * dx - p.sin_r * dy
        ry = p.sin_r * dx + p.cos_r * dy
        dx, dy = rx, ry
    fx = dx + 0.5
    fy = dy + 0.5

    ta = 1.0 if p.mode == "continuous" else p.tiles_across
    td = 1.0 if p.mode == "continuous" else p.tiles_deep

    slab_u = fx * ta
    slab_v = fy * td
    col_idx = np.floor(slab_u).astype(np.int64)
    row_idx = np.floor(slab_v).astype(np.int64)
    frac_u = slab_u - col_idx
    frac_v = slab_v - row_idx

    is_grout = np.zeros(fx.shape, dtype=bool)
    if p.grout_half_u > 0:
        is_grout = (
            (frac_u < p.grout_half_u)
            | (frac_u > 1 - p.grout_half_u)
            | (frac_v < p.grout_half_v)
            | (frac_v > 1 - p.grout_half_v)
        )

    u = frac_u.copy()
    v = frac_v.copy()

    if p.mode in ("bookmatch", "bookmatch4"):
        mirror_col = (col_idx % 2 + 2) % 2 == 1
        u = np.where(mirror_col, 1 - u, u)
    if p.mode == "bookmatch4":
        mirror_row = (row_idx % 2 + 2) % 2 == 1
        v = np.where(mirror_row, 1 - v, v)

    return u.astype(np.float32), v.astype(np.float32), is_grout
