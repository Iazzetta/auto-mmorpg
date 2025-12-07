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

from typing import Optional

class Monster(BaseModel):
    id: str
    template_id: str
    name: str
    level: int
    m_type: MonsterType
    stats: MonsterStats
    map_id: str
    position_x: float
    position_y: float
    # AI State
    target_id: Optional[str] = None
    state: str = "IDLE" # IDLE, CHASING, ATTACKING, RETURNING
    spawn_x: float = 0.0
    spawn_y: float = 0.0
    aggro_range: float = 5.0
    leash_range: float = 15.0
    last_broadcast: float = 0.0
    
    # Wandering
    wander_target_x: Optional[float] = None
    wander_target_y: Optional[float] = None
    
    possible_loot: List[str] = [] 
    xp_reward: int
    model_scale: float = 1.0
