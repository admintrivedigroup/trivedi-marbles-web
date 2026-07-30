"""
Orchestrator — port of computeFloorGeometry() + renderTextureFromGeometry() in
src/lib/visualizer/renderFloorTexture.ts. Same auto-mode pipeline order and
rollback thresholds as the TS original:

  refineFloorMask
    -> 3-pass floor plane estimation
    -> depth-gradient filter (rollback if it removes > 50% of SAM floor)
    -> surface-normal filter (rollback if it removes > 50%)
    -> floor-wall boundary filter (rollback if it removes > 50%)
    -> trapezoid intersection (+ contamination fallbacks)
    -> Grounding DINO occlusion subtraction (rollback if it removes > 35%)
    -> 10px pre-connectivity erosion (rollback if it removes > 55%)
    -> connectivity filter from the tap point
    -> erode 1px
    -> homography -> per-pixel UV -> cv2.remap sample -> lighting blend -> feather composite
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from . import geometry
from .depth_utils import compute_normals_from_depth, extract_depth_consistent_floor
from .floor_boundary import detect_floor_wall_boundary
from .floor_plane import estimate_floor_trapezoid, floor_bounding_box
from .normals import build_horizontal_mask, build_horizontal_mask_fixed
from .lighting import apply_lighting_blend
from .perspective import apply_homography_grid, compute_homography, rasterize_quad
from .texture_uv import SlabUVParams, floor_uv

ASSUMED_FLOOR_WIDTH_MM = 3600
ASSUMED_FLOOR_DEPTH_MM = 6000
DEFAULT_GROUT_PX = 3
GROUT_RGB = (158, 155, 151)
TEXTURE_REF = 2048  # matches the TS TEXTURE_W/TEXTURE_H used for grout-px scaling


class NeedsManualFloor(Exception):
    pass


@dataclass
class FloorGeometry:
    W: int
    H: int
    orig_rgb: np.ndarray
    render_mask: np.ndarray
    floor_quad: np.ndarray
    feather: np.ndarray
    lum_map: np.ndarray
    mean_lum: float
    homography: np.ndarray
    refined_coverage: float
    used_manual_quad: bool
    confidence: str
    debug: dict[str, Any] = field(default_factory=dict)


def compute_floor_geometry(
    orig_rgb: np.ndarray,
    alpha_mask_rgba: np.ndarray,
    manual_quad: np.ndarray | None = None,
    occlusion_mask: np.ndarray | None = None,
    wall_mask: np.ndarray | None = None,
    stair_mask: np.ndarray | None = None,
    furniture_mask: np.ndarray | None = None,
    skirting_mask: np.ndarray | None = None,
    depth_values: np.ndarray | None = None,
    normal_values: np.ndarray | None = None,
    tap_x: int | None = None,
    tap_y: int | None = None,
) -> FloorGeometry:
    H, W = orig_rgb.shape[:2]
    raw_mask = geometry.extract_binary_mask(alpha_mask_rgba)

    depth_used = False
    normals_used = False
    connectivity_used = False
    used_manual_quad = manual_quad is not None
    confidence = "high"

    def _effective_normals() -> np.ndarray | None:
        if normal_values is not None:
            return normal_values
        if depth_values is not None:
            return compute_normals_from_depth(depth_values)
        return None

    if manual_quad is not None:
        floor_quad = manual_quad
        candidate = rasterize_quad(manual_quad, W, H)

        if depth_values is not None:
            depth_filtered = extract_depth_consistent_floor(depth_values, candidate)
            if not np.array_equal(depth_filtered, candidate):
                candidate = depth_filtered
                depth_used = True

        eff_normals = _effective_normals()
        if eff_normals is not None:
            horizontal_mask, _ = (
                build_horizontal_mask(eff_normals, candidate)
                if normal_values is not None
                else build_horizontal_mask_fixed(eff_normals)
            )
            normal_filtered = ((candidate == 1) & (horizontal_mask == 1)).astype(np.uint8)
            pre_cov = geometry.mask_coverage(candidate)
            post_cov = geometry.mask_coverage(normal_filtered)
            if post_cov >= pre_cov * 0.20 and post_cov >= 0.005:
                candidate = normal_filtered
                normals_used = True

            boundary = detect_floor_wall_boundary(eff_normals)
            pre_b = geometry.mask_coverage(candidate)
            b_filtered = ((candidate == 1) & (boundary.below_boundary_mask == 1)).astype(np.uint8)
            if geometry.mask_coverage(b_filtered) >= pre_b * 0.30 and geometry.mask_coverage(b_filtered) >= 0.005:
                candidate = b_filtered

        if occlusion_mask is not None:
            candidate = ((candidate == 1) & (occlusion_mask != 1)).astype(np.uint8)

        prior_cov = geometry.mask_coverage(candidate)
        pre_eroded = geometry.erode_n_px(candidate, 10)
        if prior_cov > 0 and geometry.mask_coverage(pre_eroded) >= prior_cov * 0.45:
            candidate = pre_eroded

        if tap_x is not None and tap_y is not None:
            cx, cy = max(0, min(W - 1, tap_x)), max(0, min(H - 1, tap_y))
            connected = geometry.flood_fill_from_point(candidate, cx, cy)
            if geometry.mask_coverage(connected) >= 0.005:
                candidate = connected
                connectivity_used = True
            else:
                largest = geometry.largest_connected_component(candidate)
                if geometry.mask_coverage(largest) >= 0.005:
                    candidate = largest
        else:
            largest = geometry.largest_connected_component(candidate)
            if geometry.mask_coverage(largest) >= 0.005:
                candidate = largest

        render_mask = candidate

    else:
        refined = geometry.refine_floor_mask(raw_mask)
        cov_sam = geometry.mask_coverage(refined)
        if cov_sam < 0.005:
            raise NeedsManualFloor(
                "No floor area could be detected. Please tap 4 floor corners to define it manually."
            )

        plane = estimate_floor_trapezoid(refined, 0.15, 0.80)
        if plane.confidence == "low":
            p2 = estimate_floor_trapezoid(refined, 0.05, 0.95)
            if p2.confidence == "high":
                plane = p2
        if plane.confidence == "low":
            plane = floor_bounding_box(refined)
        confidence = plane.confidence

        floor_candidate = refined
        if depth_values is not None:
            depth_filtered = extract_depth_consistent_floor(depth_values, refined)
            depth_cov = geometry.mask_coverage(depth_filtered)
            if not np.array_equal(depth_filtered, refined) and depth_cov >= cov_sam * 0.50 and depth_cov >= 0.005:
                floor_candidate = depth_filtered
                depth_used = True

        eff_normals = _effective_normals()
        if eff_normals is not None:
            horizontal_mask, _ = (
                build_horizontal_mask(eff_normals, floor_candidate)
                if normal_values is not None
                else build_horizontal_mask_fixed(eff_normals)
            )
            normal_filtered = ((floor_candidate == 1) & (horizontal_mask == 1)).astype(np.uint8)
            pre_cov = geometry.mask_coverage(floor_candidate)
            post_cov = geometry.mask_coverage(normal_filtered)
            if post_cov >= pre_cov * 0.50 and post_cov >= 0.005:
                floor_candidate = normal_filtered
                normals_used = True

            boundary = detect_floor_wall_boundary(eff_normals)
            pre_boundary_cov = geometry.mask_coverage(floor_candidate)
            boundary_filtered = ((floor_candidate == 1) & (boundary.below_boundary_mask == 1)).astype(np.uint8)
            post_boundary_cov = geometry.mask_coverage(boundary_filtered)
            if post_boundary_cov >= pre_boundary_cov * 0.50 and post_boundary_cov >= 0.005:
                floor_candidate = boundary_filtered

        trap_mask = rasterize_quad(np.array(plane.trapezoid, dtype=np.float32), W, H)
        final_mask = ((floor_candidate == 1) & (trap_mask == 1)).astype(np.uint8)

        if geometry.mask_coverage(final_mask) < 0.01:
            final_mask = floor_candidate.copy()
        if geometry.mask_coverage(final_mask) > 0.45:
            final_mask = trap_mask.copy()

        cov_trapezoid = geometry.mask_coverage(final_mask)

        prior_erode = final_mask
        if occlusion_mask is not None:
            cleaned = ((final_mask == 1) & (occlusion_mask != 1)).astype(np.uint8)
            cleaned_cov = geometry.mask_coverage(cleaned)
            if cleaned_cov >= cov_trapezoid * 0.65 and cleaned_cov >= 0.005:
                prior_erode = cleaned

        prior_coverage = geometry.mask_coverage(prior_erode)
        pre_eroded = geometry.erode_n_px(prior_erode, 10)
        if prior_coverage > 0 and geometry.mask_coverage(pre_eroded) >= prior_coverage * 0.45:
            prior_erode = pre_eroded

        if tap_x is not None and tap_y is not None:
            cx, cy = max(0, min(W - 1, tap_x)), max(0, min(H - 1, tap_y))
            connected = geometry.flood_fill_from_point(prior_erode, cx, cy)
            if geometry.mask_coverage(connected) >= 0.005:
                prior_erode = connected
                connectivity_used = True
            else:
                largest = geometry.largest_connected_component(prior_erode)
                if geometry.mask_coverage(largest) >= 0.005:
                    prior_erode = largest
        else:
            largest = geometry.largest_connected_component(prior_erode)
            if geometry.mask_coverage(largest) >= 0.005:
                prior_erode = largest

        render_mask = geometry.erode_1px(prior_erode)
        floor_quad = np.array(plane.trapezoid, dtype=np.float32)

        cov_final = geometry.mask_coverage(render_mask)
        if cov_final < 0.02:
            raise NeedsManualFloor(
                f"Floor mask collapsed after filtering (coverage {cov_final * 100:.1f}%). "
                "Please tap 4 floor corners to define it manually."
            )

    feather = geometry.create_feather_mask(render_mask, feather_px=3)
    refined_coverage = geometry.mask_coverage(render_mask)

    unit_quad = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    H_mat = compute_homography(np.asarray(floor_quad, dtype=np.float32), unit_quad)
    if H_mat is None:
        raise ValueError("Floor perspective failed — quad is degenerate. Try tapping a different spot.")

    lum_map = geometry.extract_floor_luminance(orig_rgb, render_mask)
    mean_lum = geometry.mean_floor_luminance(lum_map, render_mask)

    return FloorGeometry(
        W=W,
        H=H,
        orig_rgb=orig_rgb,
        render_mask=render_mask,
        floor_quad=floor_quad,
        feather=feather,
        lum_map=lum_map,
        mean_lum=mean_lum,
        homography=H_mat,
        refined_coverage=refined_coverage,
        used_manual_quad=used_manual_quad,
        confidence=confidence,
        debug={
            "depthUsed": depth_used,
            "normalsUsed": normals_used,
            "connectivityUsed": connectivity_used,
            "coveragePct": round(refined_coverage * 100),
        },
    )


def render_texture_from_geometry(
    geo: FloorGeometry,
    slab_rgb: np.ndarray,
    mode: str = "continuous",
    tile_width_mm: float = 1200,
    tile_height_mm: float = 2400,
    grout_px: float = DEFAULT_GROUT_PX,
    rotation_deg: float = 0,
    scale_factor: float = 1.0,
) -> np.ndarray:
    slab_h, slab_w = slab_rgb.shape[:2]

    tiles_across = ASSUMED_FLOOR_WIDTH_MM / tile_width_mm
    tiles_deep = ASSUMED_FLOOR_DEPTH_MM / tile_height_mm
    tiles_across_r = max(2, round(tiles_across))
    tiles_deep_r = max(2, round(tiles_deep))
    grout_half_u = grout_px / (2 * (TEXTURE_REF / tiles_across_r)) if grout_px > 0 else 0
    grout_half_v = grout_px / (2 * (TEXTURE_REF / tiles_deep_r)) if grout_px > 0 else 0

    cos_r = np.cos(np.deg2rad(rotation_deg))
    sin_r = np.sin(np.deg2rad(rotation_deg))

    fx, fy = apply_homography_grid(geo.homography, geo.W, geo.H)
    uv_params = SlabUVParams(
        tiles_across=tiles_across,
        tiles_deep=tiles_deep,
        mode=mode,  # type: ignore[arg-type]
        grout_half_u=grout_half_u,
        grout_half_v=grout_half_v,
        cos_r=float(cos_r),
        sin_r=float(sin_r),
        scale_factor=scale_factor,
    )
    u, v, is_grout = floor_uv(fx, fy, uv_params)

    map_x = (u * slab_w).astype(np.float32)
    map_y = (v * slab_h).astype(np.float32)
    sampled = cv2.remap(
        slab_rgb, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP
    ).astype(np.float32)
    sampled[is_grout] = GROUT_RGB

    pixel_lum = np.where(geo.lum_map > 0, geo.lum_map, geo.mean_lum)
    lit = apply_lighting_blend(sampled, pixel_lum, geo.mean_lum, geo.orig_rgb.astype(np.float32))

    alpha = geo.feather[..., None]
    output = geo.orig_rgb.astype(np.float32) * (1 - alpha) + lit.astype(np.float32) * alpha
    return np.clip(np.round(output), 0, 255).astype(np.uint8)


def render_floor(
    orig_rgb: np.ndarray,
    alpha_mask_rgba: np.ndarray,
    slab_rgb: np.ndarray,
    **kwargs: Any,
) -> tuple[np.ndarray, FloorGeometry]:
    geometry_kwargs = {
        k: kwargs.pop(k)
        for k in list(kwargs)
        if k
        in (
            "manual_quad",
            "occlusion_mask",
            "wall_mask",
            "stair_mask",
            "furniture_mask",
            "skirting_mask",
            "depth_values",
            "normal_values",
            "tap_x",
            "tap_y",
        )
    }
    geo = compute_floor_geometry(orig_rgb, alpha_mask_rgba, **geometry_kwargs)
    result = render_texture_from_geometry(geo, slab_rgb, **kwargs)
    return result, geo
