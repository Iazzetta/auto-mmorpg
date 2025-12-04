from fastapi import APIRouter, HTTPException
from ..engine.state_manager import StateManager
import json
import os
from ..data.items import ITEMS

router = APIRouter()
state_manager = StateManager.get_instance()

@router.get("/editor/world")
async def get_world_data():
    if not hasattr(state_manager, 'world_data'):
        # Try to load if not present
        state_manager.load_world_data()
    return state_manager.world_data

@router.post("/editor/world")
async def save_world_data(data: dict):
    try:
        path = "backend/app/data/world.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
        
        # Reload state
        state_manager.load_world_data()
        return {"message": "World saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/editor/items")
async def get_items():
    return [{"id": k, "name": v["name"]} for k, v in ITEMS.items()]
