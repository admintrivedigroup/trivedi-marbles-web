"""
Local Depth Anything V2 inference — monocular depth for floor-plane / surface-
normal filtering. Same caching/GPU notes as segmentation.py.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np


@lru_cache
def _load_pipeline(model_id: str):
    import torch
    from transformers import pipeline

    device = 0 if torch.cuda.is_available() else -1
    return pipeline(task="depth-estimation", model=model_id, device=device)


def estimate_depth_local(image_rgb: np.ndarray, model_id: str) -> np.ndarray:
    """Returns a normalized (0..1) float32 depth map, same resolution as image_rgb."""
    from PIL import Image

    depth_pipe = _load_pipeline(model_id)
    pil_image = Image.fromarray(image_rgb)
    result = depth_pipe(pil_image)
    depth_img = result["depth"].resize((image_rgb.shape[1], image_rgb.shape[0]))
    depth = np.asarray(depth_img, dtype=np.float32)
    d_min, d_max = float(depth.min()), float(depth.max())
    if d_max - d_min < 1e-6:
        return np.zeros_like(depth)
    return (depth - d_min) / (d_max - d_min)
