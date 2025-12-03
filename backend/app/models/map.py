from pydantic import BaseModel
from typing import List, Dict

class Portal(BaseModel):
    to_map_id: str
    x: float
    y: float

class GameMap(BaseModel):
    id: str
    name: str
    min_level: int
    portals: List[Portal] = []
    # Simple bounds for the map
    width: int = 100
    height: int = 100
