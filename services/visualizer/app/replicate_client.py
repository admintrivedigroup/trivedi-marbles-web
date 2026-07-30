"""
Replicate fallback client — used for:
  - SAM-2 segmentation + Depth Anything V2 depth, when VISUALIZER_INFERENCE_MODE=replicate
  - Grounding DINO occlusion boxes, always (not in the local-model scope requested)

Mirrors the model versions already validated by the existing /inventory
visualizer (src/app/inventory/_actions/visualize.ts, detectObjects.ts) so
results are directly comparable between the two features.
"""

from __future__ import annotations

import base64
import time

import httpx
import numpy as np
from PIL import Image
import io

from .config import get_settings
from .pipeline.occlusion import BoundingBox

# Same SAM-2 version pinned in src/app/inventory/_actions/visualize.ts —
# verify at replicate.com/meta/sam-2/versions before changing.
SAM2_VERSION = "cbd95fb76192174268b6b303aeeb7a736e8dab0cbc38177f09db79b2299da30b"
POLL_INTERVAL_S = 2.0
POLL_MAX = 120

_REPLICATE_API = "https://api.replicate.com/v1/predictions"


def _headers() -> dict[str, str]:
    settings = get_settings()
    if not settings.replicate_api_token:
        raise RuntimeError("REPLICATE_API_TOKEN is not set.")
    return {
        "Authorization": f"Bearer {settings.replicate_api_token}",
        "Content-Type": "application/json",
    }


def _image_to_data_url(image_rgb: np.ndarray) -> str:
    buf = io.BytesIO()
    Image.fromarray(image_rgb).save(buf, format="JPEG", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


def _poll_until_done(client: httpx.Client, prediction_id: str) -> dict:
    for _ in range(POLL_MAX):
        time.sleep(POLL_INTERVAL_S)
        res = client.get(f"{_REPLICATE_API}/{prediction_id}", headers=_headers())
        res.raise_for_status()
        prediction = res.json()
        status = prediction["status"]
        if status == "succeeded":
            return prediction
        if status in ("failed", "canceled"):
            raise RuntimeError(prediction.get("error") or "Replicate prediction failed.")
    raise TimeoutError("Replicate prediction timed out.")


def segment_via_replicate(image_rgb: np.ndarray, tap_x: int, tap_y: int) -> np.ndarray:
    """Returns an RGBA mask array (alpha=0=floor), matching the SAM mask convention."""
    with httpx.Client(timeout=30.0) as client:
        create_res = client.post(
            _REPLICATE_API,
            headers=_headers(),
            json={
                "version": SAM2_VERSION,
                "input": {
                    "image": _image_to_data_url(image_rgb),
                    "point_coords": f"[{tap_x},{tap_y}]",
                    "point_labels": "1",
                },
            },
        )
        create_res.raise_for_status()
        prediction = _poll_until_done(client, create_res.json()["id"])

        output = prediction.get("output") or {}
        mask_url = output.get("combined_mask") or (output.get("individual_masks") or [None])[0]
        if not mask_url:
            raise RuntimeError("Replicate SAM-2 returned no mask.")

        mask_res = client.get(mask_url)
        mask_res.raise_for_status()
        return np.array(Image.open(io.BytesIO(mask_res.content)).convert("RGBA"))


def depth_via_replicate(image_rgb: np.ndarray) -> np.ndarray | None:
    """Returns a normalized (0..1) float32 depth map, same resolution as image_rgb.

    Returns None (graceful skip) if DEPTH_ANYTHING_V2_VERSION is not configured —
    same degradation behavior as getDepthMap.ts.
    """
    settings = get_settings()
    if not settings.depth_anything_version:
        return None

    with httpx.Client(timeout=30.0) as client:
        create_res = client.post(
            _REPLICATE_API,
            headers=_headers(),
            json={
                "version": settings.depth_anything_version,
                "input": {"image": _image_to_data_url(image_rgb)},
            },
        )
        create_res.raise_for_status()
        prediction = _poll_until_done(client, create_res.json()["id"])

        output = prediction.get("output")
        depth_url = output if isinstance(output, str) else (output or {}).get("depth")
        if not depth_url:
            raise RuntimeError("Replicate Depth Anything V2 returned no depth map.")

        depth_res = client.get(depth_url)
        depth_res.raise_for_status()
        depth_img = Image.open(io.BytesIO(depth_res.content)).convert("L")
        depth_img = depth_img.resize((image_rgb.shape[1], image_rgb.shape[0]))
        return np.asarray(depth_img, dtype=np.float32) / 255.0


def detect_occlusion_boxes_via_replicate(image_rgb: np.ndarray) -> list[BoundingBox]:
    """Grounding DINO furniture/stair/wall/skirting/ceiling boxes — Replicate-only
    in both local and replicate inference modes (see module docstring).

    Returns an empty list (graceful skip) if GROUNDING_DINO_VERSION is not
    configured — same degradation behavior as detectObjects.ts.
    """
    settings = get_settings()
    if not settings.grounding_dino_version:
        return []

    with httpx.Client(timeout=30.0) as client:
        create_res = client.post(
            _REPLICATE_API,
            headers=_headers(),
            json={
                "version": settings.grounding_dino_version,
                "input": {
                    "image": _image_to_data_url(image_rgb),
                    "query": "furniture . stairs . wall . skirting board . ceiling",
                },
            },
        )
        create_res.raise_for_status()
        prediction = _poll_until_done(client, create_res.json()["id"])
        detections = prediction.get("output") or []

    boxes: list[BoundingBox] = []
    for det in detections:
        label = str(det.get("label", "")).lower()
        category = (
            "stair" if "stair" in label
            else "wall_element" if "wall" in label
            else "skirting" if "skirt" in label
            else "ceiling" if "ceiling" in label
            else "furniture"
        )
        x1, y1, x2, y2 = det["bbox"]
        boxes.append(BoundingBox(x1=int(x1), y1=int(y1), x2=int(x2), y2=int(y2), category=category))
    return boxes
