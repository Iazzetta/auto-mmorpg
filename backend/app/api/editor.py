from fastapi import APIRouter, HTTPException, Header, Depends
from ..engine.state_manager import StateManager
import json
import os
from ..data.items import ITEMS

router = APIRouter()
state_manager = StateManager.get_instance()

async def verify_admin(x_player_id: str = Header(None, alias="X-Player-ID")):
    if not x_player_id:
        raise HTTPException(status_code=401, detail="Missing authentication")
    
    player = state_manager.get_player(x_player_id)
    if not player:
        raise HTTPException(status_code=401, detail="Invalid session")
        
    if not player.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return player

@router.get("/editor/world", dependencies=[Depends(verify_admin)])
async def get_world_data():
    if not hasattr(state_manager, 'world_data'):
        # Try to load if not present
        state_manager.load_world_data()
    return state_manager.world_data

@router.post("/editor/world", dependencies=[Depends(verify_admin)])
async def save_world_data(data: dict):
    try:
        path = "backend/app/data/world.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
        
        # Reload state
        state_manager.load_world_data()
        
        # Broadcast update
        if hasattr(state_manager, 'connection_manager'):
            await state_manager.connection_manager.broadcast({"type": "server_update"})

        return {"message": "World saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/editor/missions", dependencies=[Depends(verify_admin)])
async def get_missions_editor():
    try:
        with open("backend/app/data/missions.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

@router.post("/editor/missions", dependencies=[Depends(verify_admin)])
async def save_missions_editor(data: dict):
    try:
        path = "backend/app/data/missions.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
        state_manager.load_missions()
        return {"message": "Missions saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/editor/items", dependencies=[Depends(verify_admin)])
async def get_items():
    return [{"id": k, "name": v["name"]} for k, v in ITEMS.items()]

@router.post("/editor/items", dependencies=[Depends(verify_admin)])
async def save_items(data: dict):
    try:
        path = "backend/app/data/items.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
        return {"message": "Items saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/editor/rewards", dependencies=[Depends(verify_admin)])
async def get_rewards_editor():
    try:
        with open("backend/app/data/rewards.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"rewards": []}

@router.post("/editor/rewards", dependencies=[Depends(verify_admin)])
async def save_rewards_editor(data: dict):
    try:
        path = "backend/app/data/rewards.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
        return {"message": "Rewards saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/editor/npcs", dependencies=[Depends(verify_admin)])
async def get_npcs_editor():
    # Return raw dict from JSON source to preserve structure expected by Editor
    try:
        with open("backend/app/data/npcs.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

@router.post("/editor/npcs", dependencies=[Depends(verify_admin)])
async def save_npcs_editor(data: dict):
    try:
        path = "backend/app/data/npcs.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
        state_manager.load_npcs() # Reload state
        return {"message": "NPCs saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/editor/textures/floors", dependencies=[Depends(verify_admin)])
async def get_floor_textures():
    try:
        path = "client/public/maps/floor"
        if os.path.exists(path):
            files = os.listdir(path)
            # Filter images?
            return [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        return []
    except Exception as e:
        print(f"Error listing textures: {e}")
        return []

from ..services.upgrade_service import UpgradeService

@router.get("/editor/enhancement", dependencies=[Depends(verify_admin)])
async def get_enhancement_config():
    UpgradeService.load_config()
    return UpgradeService.config

@router.post("/editor/enhancement", dependencies=[Depends(verify_admin)])
async def save_enhancement_config(data: dict):
    try:
        UpgradeService.config = data
        UpgradeService.save_config()
        return {"message": "Config saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
