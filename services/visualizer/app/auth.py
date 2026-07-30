from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from .config import get_settings


async def require_shared_secret(x_visualizer_secret: str | None = Header(default=None)) -> None:
    """Shared-secret check between the Next.js API route and this service.

    The Modal deployment gets a public HTTPS URL, so this is the only thing
    stopping arbitrary internet traffic from hitting (and billing) the GPU
    endpoint directly. Set VISUALIZER_SERVICE_SECRET before deploying.
    """
    settings = get_settings()
    if not settings.service_secret:
        return  # local dev without a secret configured — see README

    if not x_visualizer_secret or not hmac.compare_digest(x_visualizer_secret, settings.service_secret):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Visualizer-Secret header.")
