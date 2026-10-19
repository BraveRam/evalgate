"""Manage the saved comparison snapshot for each suite."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from evalgate.core.baselines import BaselineSnapshot
from evalgate.core.storage import StorageEngine

router = APIRouter(prefix="/baselines", tags=["Baselines"])


class SetBaselineRequest(BaseModel):
    run_id: str


@router.get("/{suite_name}")
async def get_baseline(suite_name: str) -> BaselineSnapshot | None:
    return await StorageEngine().get_baseline(suite_name)


@router.put("/{suite_name}")
async def set_baseline(suite_name: str, req: SetBaselineRequest) -> BaselineSnapshot:
    storage = StorageEngine()
    run = await storage.get_run(req.run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run '{req.run_id}' not found")
    if run.suite_name != suite_name:
        raise HTTPException(status_code=400, detail="Run belongs to a different suite")
    try:
        return await storage.set_baseline(req.run_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.delete("/{suite_name}")
async def delete_baseline(suite_name: str) -> dict[str, str]:
    if not await StorageEngine().delete_baseline(suite_name):
        raise HTTPException(status_code=404, detail="No saved baseline for this suite")
    return {"message": "Baseline removed"}
