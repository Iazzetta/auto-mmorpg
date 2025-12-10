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
    password_hash: str = ""
    p_class: PlayerClass
    level: int = 1
    xp: int = 0
    next_level_xp: int = 100
    stats: PlayerStats
    current_map_id: str
    respawn_map_id: str = "map_castle_1"
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
    # Key: reward_id, Value: timestamp (or 0 for just claimed)
    claimed_rewards: Dict[str, float] = {}
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
    is_admin: bool = False
    
    # Runtime State (Not persisted usually, but needed for game loop)
    last_attack_time: float = 0.0
    last_movement_broadcast: float = 0.0
    last_movement_broadcast: float = 0.0
    death_time: Optional[float] = None
    gathering_start_time: float = 0.0
    gathering_resource_id: Optional[str] = None
    is_online: bool = True

    def calculate_stats(self):
        # Base stats from attributes
        # STR: +2 Atk
        # AGI: +1 Atk, +1 Def
        # VIT: +5 HP, +1 Def (Reduced from 10 to standardise starts at ~100)
        # INI: +0.1 Speed, -0.05 Cooldown
        
        str_val = self.attributes.get("str", 10)
        agi_val = self.attributes.get("agi", 10)
        vit_val = self.attributes.get("vit", 10)
        ini_val = self.attributes.get("ini", 10)

        # Formula Adjusted: 50 base + 5 per VIT. If VIT=10 => 50+50 = 100 HP.
        base_hp = 50 + (vit_val * 5)
        base_atk = 5 + (str_val * 2) + (agi_val * 1)
        base_def = 0 + (vit_val * 1) + (agi_val * 1)
        base_speed = 20.0 + (ini_val * 0.1)
        
        # Cooldown: Starts at 1.5s, reduced by INI. Min 0.3s.
        base_cooldown = 1.5 - (ini_val * 0.05)
        if base_cooldown < 0.3: base_cooldown = 0.3

        # Add Equipment Bonuses
        for slot, item in self.equipment.items():
            if item:
                # Calculate Enhancement Bonus
                # Import here to avoid circular dependency at module level
                from ..services.upgrade_service import UpgradeService
                
                # Default 5% if config missing
                bonus_pct = UpgradeService.config.get("stat_bonus_percent", {}).get(item.rarity.value, 5.0)
                
                mult = 1.0
                if item.enhancement_level > 0:
                    # Compound formula: (1 + pct/100) ^ level
                    mult = ((1.0 + (bonus_pct / 100.0)) ** item.enhancement_level)
                
                base_hp += int(item.stats.hp * mult)
                base_atk += int(item.stats.atk * mult)
                base_def += int(item.stats.def_ * mult)
                base_speed += (item.stats.speed * mult)

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

    def gain_xp(self, amount: int) -> dict:
        self.xp += amount
        leveled_up = False
        old_level = self.level
        
        while self.xp >= self.next_level_xp:
            self.xp -= self.next_level_xp
            self.level += 1
            self.attribute_points += 5
            self.calculate_stats() # Recalculate next_level_xp and stats
            self.stats.hp = self.stats.max_hp # Heal on level up
            leveled_up = True
            
        return {
            "leveled_up": leveled_up,
            "new_level": self.level,
            "xp_gained": amount
        }
