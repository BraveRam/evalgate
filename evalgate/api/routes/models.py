"""
Models and Pricing API Endpoints.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from evalgate.core.pricing import MODEL_PRICING_TABLE

router = APIRouter(prefix="/models", tags=["Models & Pricing"])


@router.get("")
async def list_supported_models() -> list[dict[str, Any]]:
    """
    List all supported foundation models and their token pricing matrix.
    """
    models: list[dict[str, Any]] = []
    for model_name, (in_price, out_price) in MODEL_PRICING_TABLE.items():
        provider = model_name.split("/")[0] if "/" in model_name else "other"
        models.append(
            {
                "id": model_name,
                "provider": provider,
                "input_price_per_1m": round(in_price * 1_000_000, 4),
                "output_price_per_1m": round(out_price * 1_000_000, 4),
                "currency": "USD",
            }
        )
    return sorted(models, key=lambda m: m["id"])
