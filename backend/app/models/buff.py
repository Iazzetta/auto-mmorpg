from enum import Enum
from pydantic import BaseModel

class BuffType(str, Enum):
    PERCENT_ATK = "pct_atk"
    PERCENT_DEF = "pct_def"
    PERCENT_HP = "pct_hp"
    PERCENT_SPEED = "pct_speed"
    CRIT_RATE = "crit_rate"
    CRIT_DMG = "crit_dmg"
    LIFESTEAL = "lifesteal"

    # For display
    def label(self):
        labels = {
            "pct_atk": "ATK",
            "pct_def": "DEF",
            "pct_hp": "HP",
            "pct_speed": "Speed",
            "crit_rate": "Crit Rate",
            "crit_dmg": "Crit Dmg",
            "lifesteal": "Lifesteal"
        }
        return labels.get(self.value, self.value)

class Buff(BaseModel):
    type: BuffType
    value: float
    meta: dict = {}  # future proofing

    def description(self) -> str:
        # returns formatted string e.g. "ATK +3%"
        val_str = f"{int(self.value * 100)}%"
        return f"{self.type.label()} +{val_str}"
