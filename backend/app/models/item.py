from enum import Enum
from pydantic import BaseModel
from typing import Optional

class ItemType(str, Enum):
    WEAPON = "weapon"
    ARMOR = "armor"
    MATERIAL = "material"
    CONSUMABLE = "consumable"

class ItemSlot(str, Enum):
    HEAD = "head"
    CHEST = "chest"
    LEGS = "legs"
    BOOTS = "boots"
    HAND_MAIN = "hand_main"
    HAND_OFF = "hand_off"
    NONE = "none"  # For materials

class ItemRarity(str, Enum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"

class ItemStats(BaseModel):
    strength: int = 0
    intelligence: int = 0
    atk: int = 0
    def_: int = 0
    speed: float = 0.0
    hp: int = 0 
    xp: int = 0
    gold: int = 0
    diamonds: int = 0

class Item(BaseModel):
    id: str
    name: str
    type: ItemType
    slot: ItemSlot
    rarity: ItemRarity
    stats: ItemStats
    power_score: int = 0
    icon: str = "📦"
    quantity: int = 1
    stackable: bool = False
    
    # Enhancement System
    enhancement_level: int = 0
    awakenings: list[str] = [] # List of awakening effect IDs

    def calculate_power_score(self):
        # Simple power score calculation
        self.power_score = self.stats.strength + self.stats.intelligence + self.stats.atk + self.stats.def_
