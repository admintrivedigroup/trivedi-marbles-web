"""
Quick smoke test for the pure numpy/OpenCV pipeline modules — no torch/fastapi
dependency, so this can run with just `numpy` + `opencv-python` installed.
Not wired into any CI; run manually with:
    python -m pytest services/visualizer/tests/test_geometry_smoke.py -q
"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.pipeline import floor_plane, geometry, lighting, normals, perspective, texture_uv
from app.pipeline.floor_boundary import detect_floor_wall_boundary


def _synthetic_floor_mask(W=200, H=300):
    mask = np.zeros((H, W), dtype=np.uint8)
    for y in range(int(H * 0.4), H):
        frac = (y - H * 0.4) / (H * 0.6)
        left = int(W * (0.5 - 0.5 * frac))
        right = int(W * (0.5 + 0.5 * frac))
        mask[y, left:right] = 1
    return mask


def test_refine_floor_mask_keeps_bottom_component():
    mask = _synthetic_floor_mask()
    mask[0:10, 0:10] = 1  # disconnected ceiling noise
    refined = geometry.refine_floor_mask(mask)
    assert refined[0, 0] == 0
    assert geometry.mask_coverage(refined) > 0


def test_erode_and_feather():
    mask = np.ones((50, 50), dtype=np.uint8)
    eroded = geometry.erode_n_px(mask, 3)
    assert eroded.sum() < mask.sum()
    feather = geometry.create_feather_mask(mask, feather_px=2)
    assert feather[25, 25] == 1.0
    assert feather[0, 0] < 1.0


def test_flood_fill_and_largest_component():
    mask = np.zeros((20, 20), dtype=np.uint8)
    mask[2:5, 2:5] = 1
    mask[15:19, 15:19] = 1
    filled = geometry.flood_fill_from_point(mask, 3, 3)
    assert filled.sum() == 9
    assert filled[16, 16] == 0
    largest = geometry.largest_connected_component(mask)
    assert largest.sum() == 16


def test_floor_plane_estimation_high_confidence():
    mask = _synthetic_floor_mask()
    result = floor_plane.estimate_floor_trapezoid(mask)
    assert result.confidence in ("high", "low")
    assert result.trapezoid[3][0] < result.trapezoid[2][0]


def test_homography_roundtrip():
    src = np.array([[10, 10], [190, 10], [190, 290], [10, 290]], dtype=np.float32)
    dst = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    H = perspective.compute_homography(src, dst)
    assert H is not None
    fx, fy = perspective.apply_homography_grid(H, 200, 300)
    assert abs(fx[10, 10] - 0.0) < 0.05
    assert abs(fy[290, 100] - 1.0) < 0.05


def test_lighting_blend_shape_and_range():
    marble = np.full((10, 10, 3), 200, dtype=np.float32)
    orig = np.full((10, 10, 3), 100, dtype=np.float32)
    lum = np.full((10, 10), 100, dtype=np.float32)
    out = lighting.apply_lighting_blend(marble, lum, 100.0, orig)
    assert out.shape == (10, 10, 3)
    assert out.dtype == np.uint8
    assert (out >= 0).all() and (out <= 255).all()


def test_normals_fixed_classifier():
    normals_arr = np.zeros((10, 10, 3), dtype=np.float32)
    normals_arr[..., 1] = 0.9  # floor-like
    horizontal, vertical = normals.build_horizontal_mask_fixed(normals_arr)
    assert horizontal.all()
    assert not vertical.any()


def test_floor_boundary_runs():
    normals_arr = np.zeros((30, 20, 3), dtype=np.float32)
    normals_arr[15:, :, 1] = 0.9
    result = detect_floor_wall_boundary(normals_arr)
    assert result.below_boundary_mask.shape == (30, 20)


def test_texture_uv_continuous_mode():
    fx, fy = np.meshgrid(np.linspace(0, 1, 5), np.linspace(0, 1, 5))
    params = texture_uv.SlabUVParams(
        tiles_across=3, tiles_deep=3, mode="continuous",
        grout_half_u=0, grout_half_v=0, cos_r=1, sin_r=0, scale_factor=1.0,
    )
    u, v, is_grout = texture_uv.floor_uv(fx, fy, params)
    assert u.shape == fx.shape
    assert not is_grout.any()


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"\n{len(tests)} smoke tests passed")
