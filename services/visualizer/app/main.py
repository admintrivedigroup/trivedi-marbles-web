from __future__ import annotations

import base64
import io

import numpy as np
from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from .auth import require_shared_secret
from .config import get_settings
from .pipeline import compose
from .replicate_client import (
    depth_via_replicate,
    detect_occlusion_boxes_via_replicate,
    segment_via_replicate,
)
from .pipeline.occlusion import build_occlusion_masks
from .schemas import RenderResponse

app = FastAPI(title="Trivedi Marbles — Visualizer Service", version="0.1.0")


def _read_image(upload_bytes: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(upload_bytes)).convert("RGB"))


def _to_data_url(image_rgb: np.ndarray) -> str:
    buf = io.BytesIO()
    Image.fromarray(image_rgb).save(buf, format="JPEG", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {"status": "ok", "mode": settings.inference_mode}


@app.post("/render", response_model=RenderResponse, dependencies=[Depends(require_shared_secret)])
async def render(
    room_photo: UploadFile,
    slab_image: UploadFile,
    tap_x: int = Form(...),
    tap_y: int = Form(...),
    mode: str = Form("continuous"),
    tile_width_mm: float = Form(1200),
    tile_height_mm: float = Form(2400),
    grout_px: float = Form(3),
    rotation_deg: float = Form(0),
    scale_factor: float = Form(1.0),
    inference_mode_override: str | None = Form(None),
) -> RenderResponse:
    settings = get_settings()
    inference_mode = (inference_mode_override or settings.inference_mode).lower()
    if inference_mode not in ("local", "replicate"):
        raise HTTPException(status_code=400, detail="mode must be 'local' or 'replicate'.")

    room_rgb = _read_image(await room_photo.read())
    slab_rgb = _read_image(await slab_image.read())

    try:
        occlusion_boxes = detect_occlusion_boxes_via_replicate(room_rgb)
    except Exception:
        occlusion_boxes = []  # graceful degradation, same as detectObjects.ts

    occlusion_masks = build_occlusion_masks(occlusion_boxes, room_rgb.shape[1], room_rgb.shape[0])

    depth_values: np.ndarray | None = None
    if inference_mode == "local":
        from .pipeline.depth import estimate_depth_local
        from .pipeline.segmentation import segment_local

        alpha_mask = segment_local(room_rgb, tap_x, tap_y, settings.sam2_checkpoint)
        depth_values = estimate_depth_local(room_rgb, settings.depth_model)
    else:
        alpha_mask = segment_via_replicate(room_rgb, tap_x, tap_y)
        depth_values = depth_via_replicate(room_rgb)  # None if DEPTH_ANYTHING_V2_VERSION unset

    try:
        result_rgb, geo = compose.render_floor(
            room_rgb,
            alpha_mask,
            slab_rgb,
            occlusion_mask=occlusion_masks.combined_occlusion,
            wall_mask=occlusion_masks.wall_mask,
            stair_mask=occlusion_masks.stair_mask,
            furniture_mask=occlusion_masks.furniture_mask,
            skirting_mask=occlusion_masks.skirting_mask,
            depth_values=depth_values,
            tap_x=tap_x,
            tap_y=tap_y,
            mode=mode,
            tile_width_mm=tile_width_mm,
            tile_height_mm=tile_height_mm,
            grout_px=grout_px,
            rotation_deg=rotation_deg,
            scale_factor=scale_factor,
        )
    except compose.NeedsManualFloor as exc:
        return JSONResponse(
            status_code=422,
            content={"error": str(exc), "needsManualFloor": True},
        )

    return RenderResponse(
        dataUrl=_to_data_url(result_rgb),
        debug={
            "confidence": geo.confidence,
            "coveragePct": round(geo.refined_coverage * 100),
            "usedManualQuad": geo.used_manual_quad,
            "depthUsed": geo.debug["depthUsed"],
            "normalsUsed": geo.debug["normalsUsed"],
            "connectivityUsed": geo.debug["connectivityUsed"],
            "mode": inference_mode,
        },
    )
