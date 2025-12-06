from pydantic import BaseModel
from typing import List, Dict, Optional

class Portal(BaseModel):
    id: str
    x: float
    y: float
    target_map_id: str
    target_x: float
    target_y: float
    color: str = "#ffffff"
    label: str = "Portal"

class ResourceDrop(BaseModel):
    item_id: str
    min_qty: int = 1
    max_qty: int = 1
    chance: float = 1.0

class ResourceTemplate(BaseModel):
    id: str
    name: str = "Resource Template"
    type: str = "box"
    color: str = "#8B4513"
    respawn_time: int = 60
    drops: List[ResourceDrop] = []
    width: float = 1.0
    height: float = 1.0

class ResourceNode(BaseModel):
    id: str
    x: float
    y: float
    template_id: Optional[str] = None
    type: str = "box" 
    color: str = "#8B4513"
    name: str = "Resource"
    respawn_time: int = 60
    drops: List[ResourceDrop] = []
    width: float = 1.0 
    height: float = 1.0

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
    resources: List[ResourceNode] = []
    texture: Optional[str] = None # Added texture field
