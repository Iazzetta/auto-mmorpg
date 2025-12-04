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
    attack_cooldown: float = 1.0

class Player(BaseModel):
    id: str
    token: str
    name: str
    p_class: PlayerClass
    level: int = 1
    xp: int = 0
    next_level_xp: int = 100
    stats: PlayerStats
    current_map_id: str
    position: Position
    state: PlayerState = PlayerState.IDLE
    target_monster_id: Optional[str] = None
    target_position: Optional[Position] = None
    
    # Mission System
    active_mission_id: Optional[str] = None
    mission_progress: int = 0
    completed_missions: List[str] = []

    # Attributes
    attributes: Dict[str, int] = {
        "str": 10,
        "agi": 10,
        "vit": 10,
        "ini": 10
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
    diamonds: int = 0
    
    # Runtime State (Not persisted usually, but needed for game loop)
    last_attack_time: float = 0.0
    last_movement_broadcast: float = 0.0

    def calculate_stats(self):
        # Base stats from attributes
        # STR: +2 Atk
        # AGI: +1 Atk, +1 Def
        # VIT: +10 HP, +1 Def
        # INI: +0.1 Speed, -0.05 Cooldown
        
        str_val = self.attributes.get("str", 10)
        agi_val = self.attributes.get("agi", 10)
        vit_val = self.attributes.get("vit", 10)
        ini_val = self.attributes.get("ini", 10)

        base_hp = 100 + (vit_val * 10)
        base_atk = 5 + (str_val * 2) + (agi_val * 1)
        base_def = 0 + (vit_val * 1) + (agi_val * 1)
        base_speed = 20.0 + (ini_val * 0.1)
        
        # Cooldown: Starts at 1.5s, reduced by INI. Min 0.3s.
        base_cooldown = 1.5 - (ini_val * 0.05)
        if base_cooldown < 0.3: base_cooldown = 0.3

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
        self.stats.attack_cooldown = round(base_cooldown, 2)
        
        # Clamp current HP
        if self.stats.hp > self.stats.max_hp:
            self.stats.hp = self.stats.max_hp
        
        # Quadratic XP Curve
        self.next_level_xp = int(100 * (self.level ** 2))
            
    def get_combat_power(self) -> int:
        return self.stats.atk + self.stats.def_ + (self.stats.max_hp // 10)
