from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    inference_mode: str  # "local" | "replicate"
    service_secret: str | None
    replicate_api_token: str | None
    sam2_checkpoint: str
    depth_model: str
    # Same Replicate version-pin env vars already populated in .env.local for
    # the existing /inventory visualizer's Grounding DINO / Depth Anything V2
    # calls — reused here rather than duplicating separate pins. Note:
    # getDepthMap.ts itself reads the differently-named DEPTH_ANYTHING_VERSION
    # (a pre-existing mismatch in that file, not touched by this feature) —
    # DEPTH_ANYTHING_V2_VERSION below is the name actually set in .env.local.
    grounding_dino_version: str
    depth_anything_version: str

    @property
    def uses_local_models(self) -> bool:
        return self.inference_mode == "local"


@lru_cache
def get_settings() -> Settings:
    return Settings(
        inference_mode=os.environ.get("VISUALIZER_INFERENCE_MODE", "replicate").lower(),
        service_secret=os.environ.get("VISUALIZER_SERVICE_SECRET"),
        replicate_api_token=os.environ.get("REPLICATE_API_TOKEN"),
        sam2_checkpoint=os.environ.get("VISUALIZER_SAM2_CHECKPOINT", "facebook/sam2.1-hiera-base-plus"),
        depth_model=os.environ.get("VISUALIZER_DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Base-hf"),
        grounding_dino_version=os.environ.get("GROUNDING_DINO_VERSION", ""),
        depth_anything_version=os.environ.get("DEPTH_ANYTHING_V2_VERSION", ""),
    )
