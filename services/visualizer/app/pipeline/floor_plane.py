"""
Floor plane / trapezoid estimation — port of src/lib/visualizer/floorPlane.ts.

Linear regression over the refined floor mask's row extents, same three-pass
strategy as the TS renderer (standard band, wide band, bounding-box fallback).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

Quad = tuple[tuple[float, float], tuple[float, float], tuple[float, float], tuple[float, float]]
Confidence = Literal["high", "low"]


@dataclass
class FloorPlaneResult:
    trapezoid: Quad
    vanishing_point: tuple[float, float]
    horizon_y: float
    confidence: Confidence


def _row_extents(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, int, int]:
    H, W = mask.shape
    has_floor = mask.any(axis=1)
    row_left = np.full(H, W, dtype=np.int32)
    row_right = np.full(H, -1, dtype=np.int32)

    rows_with_floor = np.where(has_floor)[0]
    if rows_with_floor.size == 0:
        return row_left, row_right, H, -1

    for y in rows_with_floor:
        xs = np.where(mask[y] == 1)[0]
        row_left[y] = xs[0]
        row_right[y] = xs[-1]

    return row_left, row_right, int(rows_with_floor[0]), int(rows_with_floor[-1])


def _fit_x_of_y(points: list[tuple[float, float]]) -> tuple[float, float]:
    n = len(points)
    if n < 2:
        return 0.0, (points[0][1] if points else 0.0)

    ys = np.array([p[0] for p in points], dtype=np.float64)
    xs = np.array([p[1] for p in points], dtype=np.float64)
    sum_y, sum_x = ys.sum(), xs.sum()
    sum_yx = (ys * xs).sum()
    sum_y2 = (ys * ys).sum()
    denom = n * sum_y2 - sum_y * sum_y
    if abs(denom) < 1e-10:
        return 0.0, sum_x / n
    a = (n * sum_yx - sum_y * sum_x) / denom
    b = (sum_x - a * sum_y) / n
    return a, b


def _clamp_x(x: float, W: int) -> float:
    return max(0.0, min(W - 1.0, x))


def _fallback(W: int, H: int) -> FloorPlaneResult:
    return FloorPlaneResult(
        trapezoid=((0, 0), (W, 0), (W, H), (0, H)),
        vanishing_point=(W / 2, H / 2),
        horizon_y=H / 2,
        confidence="low",
    )


def estimate_floor_trapezoid(
    floor_mask: np.ndarray,
    fit_start_frac: float = 0.15,
    fit_end_frac: float = 0.80,
) -> FloorPlaneResult:
    H, W = floor_mask.shape
    row_left, row_right, top_row, bottom_row = _row_extents(floor_mask)

    fallback = _fallback(W, H)
    if bottom_row < 0 or top_row >= bottom_row:
        return fallback

    floor_span = bottom_row - top_row
    if floor_span < 20:
        return fallback

    fit_start_y = round(top_row + floor_span * fit_start_frac)
    fit_end_y = round(top_row + floor_span * fit_end_frac)

    left_pts = [(y, float(row_left[y])) for y in range(fit_start_y, fit_end_y + 1) if row_left[y] < W]
    right_pts = [(y, float(row_right[y])) for y in range(fit_start_y, fit_end_y + 1) if row_right[y] >= 0]

    if len(left_pts) < 5 or len(right_pts) < 5:
        return fallback

    a_l, b_l = _fit_x_of_y(left_pts)
    a_r, b_r = _fit_x_of_y(right_pts)

    d_a = a_l - a_r
    if abs(d_a) < 0.005:
        tl_x = _clamp_x(row_left[top_row], W)
        tr_x = _clamp_x(row_right[top_row], W)
        bl_x = _clamp_x(row_left[bottom_row], W)
        br_x = _clamp_x(row_right[bottom_row], W)
        near_w = abs(br_x - bl_x)
        far_w = abs(tr_x - tl_x)
        if near_w > W * 0.04 and far_w > W * 0.04:
            return FloorPlaneResult(
                trapezoid=(
                    (min(tl_x, tr_x), top_row),
                    (max(tl_x, tr_x), top_row),
                    (max(bl_x, br_x), bottom_row),
                    (min(bl_x, br_x), bottom_row),
                ),
                vanishing_point=(W / 2, top_row - floor_span),
                horizon_y=top_row,
                confidence="high",
            )
        return FloorPlaneResult(
            trapezoid=fallback.trapezoid,
            vanishing_point=(W / 2, top_row),
            horizon_y=top_row,
            confidence="low",
        )

    vp_y = (b_r - b_l) / d_a
    vp_x = a_l * vp_y + b_l

    vp_above = vp_y < top_row
    vp_centered = W * 0.05 < vp_x < W * 0.95
    far_w = abs((a_r * top_row + b_r) - (a_l * top_row + b_l))
    near_w = abs((a_r * bottom_row + b_r) - (a_l * bottom_row + b_l))
    has_convergence = near_w > 0 and far_w / near_w < 0.98

    confidence: Confidence = "high" if (vp_above and vp_centered and has_convergence) else "low"

    tl_x = _clamp_x(round(a_l * top_row + b_l), W)
    tr_x = _clamp_x(round(a_r * top_row + b_r), W)
    bl_x = _clamp_x(round(a_l * bottom_row + b_l), W)
    br_x = _clamp_x(round(a_r * bottom_row + b_r), W)

    trapezoid: Quad = (
        (min(tl_x, tr_x), top_row),
        (max(tl_x, tr_x), top_row),
        (max(bl_x, br_x), bottom_row),
        (min(bl_x, br_x), bottom_row),
    )

    trap_w = trapezoid[2][0] - trapezoid[3][0]
    trap_w_frac = trap_w / W
    if trap_w_frac < 0.05 or trap_w_frac > 0.99:
        return FloorPlaneResult(
            trapezoid=fallback.trapezoid,
            vanishing_point=(vp_x, vp_y),
            horizon_y=vp_y,
            confidence="low",
        )

    return FloorPlaneResult(
        trapezoid=trapezoid,
        vanishing_point=(vp_x, vp_y),
        horizon_y=max(0.0, min(H, vp_y)),
        confidence=confidence,
    )


def floor_bounding_box(floor_mask: np.ndarray) -> FloorPlaneResult:
    H, W = floor_mask.shape
    row_left, row_right, top_row, bottom_row = _row_extents(floor_mask)

    if bottom_row < 0:
        return _fallback(W, H)

    tl_x = float(row_left[top_row]) if row_left[top_row] < W else 0.0
    tr_x = float(row_right[top_row]) if row_right[top_row] >= 0 else float(W)
    bl_x = float(row_left[bottom_row]) if row_left[bottom_row] < W else 0.0
    br_x = float(row_right[bottom_row]) if row_right[bottom_row] >= 0 else float(W)

    return FloorPlaneResult(
        trapezoid=(
            (min(tl_x, tr_x), top_row),
            (max(tl_x, tr_x), top_row),
            (max(bl_x, br_x), bottom_row),
            (min(bl_x, br_x), bottom_row),
        ),
        vanishing_point=(W / 2, top_row),
        horizon_y=top_row,
        confidence="high",
    )
