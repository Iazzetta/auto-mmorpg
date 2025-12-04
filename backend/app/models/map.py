from pydantic import BaseModel
from typing import List, Dict

class Portal(BaseModel):
    id: str
    x: float
    y: float
    target_map_id: str
    target_x: float
    target_y: float
    color: str = "#ffffff"
    label: str = "Portal"

class GameMap(BaseModel):
    id: str
    name: str
    type: str = "field" # field, castle, dungeon
    level_requirement: int = 0
    width: int = 100
    height: int = 100
    respawn_x: float = 50.0
    respawn_y: float = 50.0
    portals: List[Portal] = []
    spawns: List[Dict] = []
