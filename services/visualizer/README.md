# Visualizer service

Standalone FastAPI microservice for the Room/Product Visualizer feature
(`src/app/visualizer`). Not a Next.js API route — this does the actual
CV/ML work (segmentation, depth estimation, perspective warp, lighting blend)
and is called by `src/app/api/visualizer/jobs/route.ts` over plain HTTP.

Ports the already-validated algorithms from the existing `/inventory`
visualizer (`src/lib/visualizer/*.ts`) to numpy/OpenCV — same thresholds and
pipeline order, see `app/pipeline/compose.py` for the full pipeline docstring.

## Two inference modes

- **`replicate`** (default, no GPU needed) — calls Replicate for SAM-2 and
  Depth Anything V2, same models the existing `/inventory` visualizer already
  uses successfully. Good for local development and as a fallback if a GPU
  host isn't available.
- **`local`** — runs SAM2 and Depth Anything V2 in-process on GPU. This is
  the primary path requested for this feature; see "GPU/CPU implications"
  below before choosing it for a real deployment.

Grounding DINO (occlusion detection: furniture/stairs/walls/skirting/ceiling)
always goes through Replicate in both modes — local hosting wasn't in scope
for this feature's Python service.

Toggle with `VISUALIZER_INFERENCE_MODE=local|replicate` (see `.env.example`).

## Local setup

Requires **Python 3.11 or 3.12** (Modal's default image above pins 3.11;
`torch`/`transformers` wheels lag behind on brand-new Python releases, so
avoid 3.13+ for this service even though it may be installed elsewhere on
your machine).

```bash
cd services/visualizer
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
cp .env.example .env

# Fast path — no GPU, no model downloads, exercises the same Replicate
# models the /inventory visualizer already uses:
pip install fastapi uvicorn[standard] python-multipart pydantic numpy \
            opencv-python-headless pillow httpx
# set VISUALIZER_INFERENCE_MODE=replicate and REPLICATE_API_TOKEN in .env
uvicorn app.main:app --reload --port 8000 --env-file .env
```

`--env-file .env` is what actually loads the values from `.env` — the app
reads `os.environ` directly (no `python-dotenv`), so without this flag the
vars you set in `.env` are silently ignored. Port 8000 matches the
`VISUALIZER_SERVICE_URL=http://localhost:8000` default in the Next.js app's
`.env.local`; change both together if you use a different port.

To exercise the **local** GPU path instead:

```bash
pip install -r requirements.txt   # adds torch/transformers/accelerate — large download
# set VISUALIZER_INFERENCE_MODE=local in .env
uvicorn app.main:app --reload --port 8000 --env-file .env
```

Smoke-test the pure math (no FastAPI/torch needed — just numpy + opencv-python):

```bash
python -m pytest tests/test_geometry_smoke.py -q
```

## GPU/CPU implications (local mode)

- SAM2 (`hiera-base-plus`) + Depth Anything V2 (`Base`) together run in
  roughly **1–3 seconds** on a mid-tier GPU (e.g. Modal's A10G/T4). On CPU
  this is **30 seconds to 2+ minutes per image** — not viable for an
  interactive tool. Use `replicate` mode instead of local mode on any
  CPU-only host.
- One-time model download sizes (cached after first download):
  - SAM2 `hiera-base-plus` ≈ 320 MB (`hiera-large` ≈ 900 MB, set via
    `VISUALIZER_SAM2_CHECKPOINT`)
  - Depth Anything V2 `Base` ≈ 390 MB (`Small` ≈ 100 MB, `Large` ≈ 1.3 GB, set
    via `VISUALIZER_DEPTH_MODEL`)

## Deploying to Modal

```bash
pip install modal
modal setup   # first time only

# Shared secret the Next.js route sends as X-Visualizer-Secret — must match
# VISUALIZER_SERVICE_SECRET and REPLICATE_API_TOKEN in the Next.js env.
modal secret create visualizer-secrets \
  VISUALIZER_SERVICE_SECRET=<generate-a-random-string> \
  REPLICATE_API_TOKEN=<same-token-as-the-nextjs-app> \
  GROUNDING_DINO_VERSION=<optional-replicate-version-hash> \
  DEPTH_ANYTHING_V2_VERSION=<optional-replicate-version-hash>

modal deploy modal_app.py
```

This prints a web endpoint URL — set that as `VISUALIZER_SERVICE_URL` in the
Next.js app's server-only env, and `VISUALIZER_SERVICE_SECRET` to the same
value used above. Cold starts (container spin-up + first-time model download
into the `visualizer-model-cache` Modal Volume) take roughly 10–30s; set
`min_containers=1` in `modal_app.py` to keep a GPU warm and eliminate them
(trades idle GPU cost for latency).

## A/B'ing local vs. Replicate quality

Every `/render` request accepts an optional `inference_mode_override` form
field (`local` or `replicate`) that overrides `VISUALIZER_INFERENCE_MODE` for
that single request, so you can compare both on the same input without
redeploying.
