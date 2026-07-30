"""
Occlusion mask construction — port of src/lib/visualizer/occlusionUtils.ts.

Boxes come from Grounding DINO (always via Replicate — see replicate_client.py;
not in the local-model scope requested for this service).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

BoxCategory = Literal["furniture", "stair", "wall_element", "skirting", "ceiling", "floor_hint", "other"]

_BLOCK_CATEGORIES = {"furniture", "stair", "wall_element", "skirting", "ceiling", "other"}


@dataclass
class BoundingBox:
    x1: int
    y1: int
    x2: int
    y2: int
    category: BoxCategory


@dataclass
class OcclusionMasks:
    furniture_mask: np.ndarray
    stair_mask: np.ndarray
    wall_mask: np.ndarray
    skirting_mask: np.ndarray
    ceiling_mask: np.ndarray
    combined_occlusion: np.ndarray


def build_occlusion_masks(boxes: list[BoundingBox], W: int, H: int) -> OcclusionMasks:
    furniture_mask = np.zeros((H, W), dtype=np.uint8)
    stair_mask = np.zeros((H, W), dtype=np.uint8)
    wall_mask = np.zeros((H, W), dtype=np.uint8)
    skirting_mask = np.zeros((H, W), dtype=np.uint8)
    ceiling_mask = np.zeros((H, W), dtype=np.uint8)

    targets = {
        "furniture": furniture_mask,
        "stair": stair_mask,
        "wall_element": wall_mask,
        "skirting": skirting_mask,
        "ceiling": ceiling_mask,
        "other": furniture_mask,
    }

    for box in boxes:
        if box.category not in _BLOCK_CATEGORIES:
            continue
        x1, y1 = max(0, box.x1), max(0, box.y1)
        x2, y2 = min(W - 1, box.x2), min(H - 1, box.y2)
        if x2 < x1 or y2 < y1:
            continue
        targets[box.category][y1 : y2 + 1, x1 : x2 + 1] = 1

    combined = np.zeros((H, W), dtype=np.uint8)
    for m in (furniture_mask, stair_mask, wall_mask, skirting_mask, ceiling_mask):
        combined = np.maximum(combined, m)

    return OcclusionMasks(
        furniture_mask=furniture_mask,
        stair_mask=stair_mask,
        wall_mask=wall_mask,
        skirting_mask=skirting_mask,
        ceiling_mask=ceiling_mask,
        combined_occlusion=combined,
    )
