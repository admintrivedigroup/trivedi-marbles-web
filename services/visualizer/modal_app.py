"""
Modal deployment entrypoint for the Visualizer FastAPI service.

Deploy:
    modal deploy modal_app.py
Then set VISUALIZER_SERVICE_URL (Next.js env) to the printed web endpoint URL,
and VISUALIZER_SERVICE_SECRET to the same value configured as a Modal secret
(see README.md "Deploying to Modal").

GPU container holds the loaded SAM2 + Depth Anything V2 models for its whole
lifetime (see `@modal.enter()` below) so only the FIRST request per container
pays the model-load cost — subsequent requests on a warm container are fast.
Set `min_containers=1` below to keep one container warm at all times and
eliminate cold starts entirely, at the cost of paying for idle GPU time.
"""

import os

import modal

MODEL_CACHE_VOLUME = modal.Volume.from_name("visualizer-model-cache", create_if_missing=True)
MODEL_CACHE_PATH = "/cache/huggingface"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")  # required by opencv-python-headless
    .pip_install_from_requirements("requirements.txt")
    .env({"HF_HOME": MODEL_CACHE_PATH})
)

app = modal.App("trivedi-visualizer", image=image)


@app.cls(
    gpu="A10G",
    volumes={MODEL_CACHE_PATH: MODEL_CACHE_VOLUME},
    secrets=[modal.Secret.from_name("visualizer-secrets")],
    scaledown_window=300,
    min_containers=0,  # set to 1 to keep a GPU warm and eliminate cold starts
)
class VisualizerService:
    @modal.enter()
    def load_models(self):
        os.environ.setdefault("VISUALIZER_INFERENCE_MODE", "local")

        from app.config import get_settings
        from app.pipeline.depth import _load_pipeline
        from app.pipeline.segmentation import _load_predictor

        settings = get_settings()
        _load_predictor(settings.sam2_checkpoint)
        _load_pipeline(settings.depth_model)

    @modal.asgi_app()
    def web(self):
        from app.main import app as fastapi_app

        return fastapi_app
