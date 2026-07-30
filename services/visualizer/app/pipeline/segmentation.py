"""
Local SAM2 segmentation — point-prompt floor/wall/product isolation.

Loaded lazily and cached per-process: on Modal this means once per GPU
container (see ../../modal_app.py), not once per request.

Requires: torch, transformers>=4.56 (Sam2Model/Sam2Processor were added in
transformers 4.56.0), a CUDA GPU for interactive latency (see README.md
"GPU/CPU implications").
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np


@lru_cache
def _load_predictor(checkpoint: str):
    import torch
    from transformers import Sam2Model, Sam2Processor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = Sam2Model.from_pretrained(checkpoint).to(device)
    processor = Sam2Processor.from_pretrained(checkpoint)
    return model, processor, device


def segment_local(image_rgb: np.ndarray, tap_x: int, tap_y: int, checkpoint: str) -> np.ndarray:
    """Returns an RGBA mask array (alpha=0=floor), matching the SAM mask
    convention used throughout the rest of the pipeline (geometry.extract_binary_mask)."""
    import torch
    from PIL import Image

    model, processor, device = _load_predictor(checkpoint)
    pil_image = Image.fromarray(image_rgb)

    inputs = processor(
        images=pil_image,
        input_points=[[[[tap_x, tap_y]]]],
        input_labels=[[[1]]],
        return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)

    masks = processor.image_processor.post_process_masks(
        outputs.pred_masks.cpu(), inputs["original_sizes"].cpu(), inputs["reshaped_input_sizes"].cpu()
    )
    scores = outputs.iou_scores.cpu().numpy().reshape(-1)
    best_idx = int(np.argmax(scores))
    best_mask = masks[0][0][best_idx].numpy().astype(bool)

    H, W = image_rgb.shape[:2]
    rgba = np.full((H, W, 4), 255, dtype=np.uint8)
    rgba[best_mask, 3] = 0  # alpha=0 => floor, matching Replicate SAM-2 mask convention
    return rgba
