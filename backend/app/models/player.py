from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from .item import Item, ItemSlot

class PlayerClass(str, Enum):
    WARRIOR = "warrior"
    MAGE = "mage"
    ARCHER = "archer"

class PlayerState(str, Enum):
    IDLE = "idle"
    MOVING = "moving"
    COMBAT = "combat"

class Position(BaseModel):
    x: float
    y: float

class PlayerStats(BaseModel):
    hp: int
    max_hp: int
    atk: int
    def_: int
    speed: float

class Player(BaseModel):
    id: str
    name: str
    p_class: PlayerClass
    level: int = 1
    xp: int = 0
    stats: PlayerStats
    current_map_id: str
    position: Position
    state: PlayerState = PlayerState.IDLE
    target_monster_id: Optional[str] = None
    
    # Mission System
    active_mission_id: Optional[str] = None
    mission_progress: int = 0
    completed_missions: List[str] = []

    # Attributes
    attributes: Dict[str, int] = {
        "str": 10,
        "agi": 10,
        "vit": 10,
        "int": 10
    }
    attribute_points: int = 0

    # Inventory and Equipment
    inventory: List[Item] = []
    equipment: Dict[ItemSlot, Optional[Item]] = {
        ItemSlot.HEAD: None,
        ItemSlot.CHEST: None,
        ItemSlot.LEGS: None,
        ItemSlot.BOOTS: None,
        ItemSlot.HAND_MAIN: None,
        ItemSlot.HAND_OFF: None
    }
    gold: int = 0

    def calculate_stats(self):
        # Base stats from attributes
        # STR: +2 Atk
        # AGI: +1 Atk, +1 Def, +0.02 Speed
        # VIT: +10 HP, +1 Def
        # INT: +0.5 Atk (Magic), +0.5 Def (Magic Res) - Simplified for now
        
        str_val = self.attributes.get("str", 10)
        agi_val = self.attributes.get("agi", 10)
        vit_val = self.attributes.get("vit", 10)
        int_val = self.attributes.get("int", 10)

        base_hp = 100 + (vit_val * 10)
        base_atk = 5 + (str_val * 2) + (agi_val * 1)
        base_def = 0 + (vit_val * 1) + (agi_val * 1)
        base_speed = 1.0 + (agi_val * 0.02)

        # Add Equipment Bonuses
        for slot, item in self.equipment.items():
            if item:
                base_hp += item.stats.hp
                base_atk += item.stats.atk
                base_def += item.stats.def_
                base_speed += item.stats.speed

        self.stats.max_hp = int(base_hp)
        self.stats.atk = int(base_atk)
        self.stats.def_ = int(base_def)
        self.stats.speed = round(base_speed, 2)
        
        # Clamp current HP
        if self.stats.hp > self.stats.max_hp:
            self.stats.hp = self.stats.max_hp
            
    def get_combat_power(self) -> int:
        return self.stats.atk + self.stats.def_ + (self.stats.max_hp // 10)
