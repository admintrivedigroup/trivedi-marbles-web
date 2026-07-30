"""
Lighting/shadow-transfer blend — port of src/lib/visualizer/lightingBlend.ts.

Strategy (unchanged from the TS original):
  65% multiply-adjusted marble — preserves cast shadows and the room's ambient
    brightness gradient without inventing reflections.
  35% soft-light — lifts mid-tones so the marble doesn't look flat/chalky.

Vectorized over full image arrays (float32, 0..255) instead of per-pixel.
"""

from __future__ import annotations

import numpy as np


def soft_light(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    d = np.where(dst <= 0.25, ((16 * dst - 12) * dst + 4) * dst, np.sqrt(np.clip(dst, 0, None)))
    low = dst - (1 - 2 * src) * dst * (1 - dst)
    high = dst + (2 * src - 1) * (d - dst)
    return np.where(src <= 0.5, low, high)


def apply_lighting_blend(
    marble_rgb: np.ndarray,  # (H, W, 3) float32, 0..255
    pixel_lum: np.ndarray,  # (H, W) float32
    mean_lum: float,
    orig_rgb: np.ndarray,  # (H, W, 3) float32, 0..255
) -> np.ndarray:
    norm = pixel_lum / mean_lum if mean_lum > 0 else np.ones_like(pixel_lum)
    m_factor = np.clip(0.55 * norm + 0.45, 0.40, 1.30)[..., None]

    soft = soft_light(marble_rgb / 255.0, orig_rgb / 255.0) * 255.0

    blended = marble_rgb * m_factor * 0.65 + soft * 0.35
    return np.clip(np.round(blended), 0, 255).astype(np.uint8)
