from enum import Enum
from pydantic import BaseModel
from typing import List
from .item import Item

class MonsterType(str, Enum):
    AGGRESSIVE = "aggressive"
    PASSIVE = "passive"
    BOSS = "boss"

class MonsterStats(BaseModel):
    hp: int
    max_hp: int
    atk: int
    def_: int
    speed: float

class Monster(BaseModel):
    id: str
    template_id: str # Added for tracking type
    name: str
    level: int
    m_type: MonsterType
    stats: MonsterStats
    map_id: str
    position_x: float
    position_y: float
    # Simple loot table: list of item IDs or Item objects that can drop
    possible_loot: List[str] = [] 
    xp_reward: int
