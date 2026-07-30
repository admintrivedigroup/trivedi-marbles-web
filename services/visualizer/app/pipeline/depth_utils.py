"""Depth Anything V2 utilities — port of src/lib/visualizer/depthUtils.ts."""

from __future__ import annotations

import cv2
import numpy as np


def compute_depth_gradient(depth: np.ndarray) -> np.ndarray:
    gx = cv2.Sobel(depth, cv2.CV_32F, 1, 0, ksize=3, scale=1 / 8)
    gy = cv2.Sobel(depth, cv2.CV_32F, 0, 1, ksize=3, scale=1 / 8)
    grad = np.sqrt(gx * gx + gy * gy)
    grad[0, :] = 0
    grad[-1, :] = 0
    grad[:, 0] = 0
    grad[:, -1] = 0
    return grad


def extract_depth_consistent_floor(depth: np.ndarray, sam_floor_mask: np.ndarray) -> np.ndarray:
    grad = compute_depth_gradient(depth)
    floor_px = sam_floor_mask == 1
    count = int(floor_px.sum())
    if count == 0:
        return sam_floor_mask.copy()

    floor_grad = grad[floor_px]
    mean = float(floor_grad.mean())
    peak = float(floor_grad.max())
    threshold = min(peak * 0.65, mean * 2.5, 0.07)

    result = ((sam_floor_mask == 1) & (grad <= threshold)).astype(np.uint8)
    kept = int(result.sum())

    if kept < count * 0.4:
        return sam_floor_mask.copy()
    return result


def compute_normals_from_depth(depth: np.ndarray) -> np.ndarray:
    H, W = depth.shape
    scale_x = W * 0.5
    scale_y = H * 0.5

    dx = np.zeros((H, W), dtype=np.float32)
    dy = np.zeros((H, W), dtype=np.float32)
    dx[:, 1:-1] = (depth[:, 2:] - depth[:, :-2]) * scale_x
    dy[1:-1, :] = (depth[2:, :] - depth[:-2, :]) * scale_y

    nx = -dx
    ny = -dy
    nz = np.ones((H, W), dtype=np.float32)

    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    length[length == 0] = 1.0

    normals = np.stack([nx / length, ny / length, nz / length], axis=-1)
    normals[0, :, :] = 0
    normals[-1, :, :] = 0
    normals[:, 0, :] = 0
    normals[:, -1, :] = 0
    return normals.astype(np.float32)
