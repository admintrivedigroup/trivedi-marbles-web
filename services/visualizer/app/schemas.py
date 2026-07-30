from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

TextureMode = Literal["continuous", "tile", "bookmatch", "bookmatch4"]


class RenderDebugInfo(BaseModel):
    confidence: Literal["high", "low"]
    coveragePct: int
    usedManualQuad: bool
    depthUsed: bool
    normalsUsed: bool
    connectivityUsed: bool
    mode: Literal["local", "replicate"]


class RenderResponse(BaseModel):
    dataUrl: str
    debug: RenderDebugInfo


class ErrorResponse(BaseModel):
    error: str
    needsManualFloor: bool = False
