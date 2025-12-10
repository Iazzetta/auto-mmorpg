import random
import json
import os
from ..models.player import Player
from ..models.item import Item, ItemRarity, ItemType
from ..services.inventory_service import InventoryService
from ..engine.state_manager import StateManager

CONFIG_PATH = "backend/app/data/enhancement_config.json"

class UpgradeService:
    # Default Configuration
    DEFAULT_CONFIG = {
        "success_rates": {
            "0-3": 100,
            "4-6": 85,
            "7-9": 75,
            "10-15": 65
        },
        "cost_multipliers": {
            "common": 1.0,
            "uncommon": 1.0,
            "rare": 1.0,
            "epic": 1.5,
            "legendary": 2.0
        },
        "failure_penalty_percent": 50,
        "stat_bonus_percent": {
            "common": 5.0,
            "uncommon": 5.0,
            "rare": 5.0,
            "epic": 5.0,
            "legendary": 5.0
        },
        "max_level": 15
    }
    
    config = DEFAULT_CONFIG

    @classmethod
    def load_config(cls):
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r") as f:
                    cls.config = json.load(f)
                    
                # Migration: stat_bonus_percent int -> dict
                if isinstance(cls.config.get("stat_bonus_percent"), (int, float)):
                    val = float(cls.config["stat_bonus_percent"])
                    cls.config["stat_bonus_percent"] = {
                        "common": val, "uncommon": val, "rare": val, "epic": val, "legendary": val
                    }
                    
                # Migration: base_cost -> cost_multipliers
                if "cost_multipliers" not in cls.config and "base_cost" in cls.config:
                    # Old base_cost was: rate (rare), epic, legendary.
                    base = cls.config["base_cost"]
                    cls.config["cost_multipliers"] = {
                        "common": 1.0,
                        "uncommon": 1.0,
                        "rare": float(base.get("rate", 1.0)),
                        "epic": float(base.get("epic", 2.0)),
                        "legendary": float(base.get("legendary", 3.0))
                    }
                
                # Check for missing keys in dicts (partial config)
                defaults = cls.DEFAULT_CONFIG
                for key in ["cost_multipliers", "stat_bonus_percent"]:
                   if key not in cls.config:
                       cls.config[key] = defaults[key]
            except Exception as e:
                print(f"Error loading enhancement config: {e}")
                cls.config = cls.DEFAULT_CONFIG
        else:
            cls.save_config() # Create default

    @classmethod
    def save_config(cls):
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            json.dump(cls.config, f, indent=4)

    @classmethod
    def get_success_rate(cls, level: int) -> int:
        rates = cls.config.get("success_rates", {})
        
        # 1. Check Exact Match (int or str)
        if level in rates: return rates[level]
        if str(level) in rates: return rates[str(level)]
        
        # 2. Check Ranges
        for key, rate in rates.items():
            if "-" in key:
                try:
                    start, end = map(int, key.split("-"))
                    if start <= level <= end:
                        return rate
                except ValueError:
                    continue
        
        # 3. Default fallback
        return 0

    @classmethod
    def get_cost(cls, item: Item) -> int:
        mult = cls.config.get("cost_multipliers", {}).get(item.rarity.value, 1.0)
        
        # Scaling cost: (Base 1 + Level) * Multiplier
        base_cost = 1 + item.enhancement_level
        return int(base_cost * mult)

    @classmethod
    def get_catalyst_count(cls, player: Player) -> int:
        count = 0
        for item in player.inventory:
            if item.id.startswith("item_catalyst"):
                count += item.quantity
        return count

    @classmethod
    def consume_catalysts(cls, player: Player, amount: int):
        remaining = amount
        to_remove = []
        
        # Iterate inventory to consume
        for item in player.inventory:
            if item.id.startswith("item_catalyst"):
                if item.quantity >= remaining:
                    item.quantity -= remaining
                    remaining = 0
                    if item.quantity == 0:
                        to_remove.append(item)
                    break
                else:
                    remaining -= item.quantity
                    item.quantity = 0
                    to_remove.append(item)
        
        for item in to_remove:
            player.inventory.remove(item)

    @classmethod
    def upgrade_item(cls, player: Player, item_instance_id: str):
        # Find item (Inventory or Equipment?)
        # For now, let's assume it MUST be in INVENTORY to upgrade.
        # Or let's support both. Logic is simpler if in Inventory.
        # User requirement: "Na direita ficam os itens... Quando clicar aparece no slot".
        # Safe to assume we primarily target inventory or unequipped items.
        # But players hate unequipping to upgrade.
        # Let's search both.

        target_item = None
        in_equipment = False
        
        for item in player.inventory:
            if item.id == item_instance_id:
                target_item = item
                break
        
        if not target_item:
            for slot, item in player.equipment.items():
                if item and item.id == item_instance_id:
                    target_item = item
                    in_equipment = True
                    break
        
        if not target_item:
            return {"success": False, "message": "Item not found"}

        if target_item.rarity in ["common", "uncommon"]:
             return {"success": False, "message": "Item rarity too low"}

        if target_item.enhancement_level >= cls.config["max_level"]:
             return {"success": False, "message": "Max level reached"}

        cost = cls.get_cost(target_item)
        owned = cls.get_catalyst_count(player)

        if owned < cost:
             return {"success": False, "message": f"Need {cost} Catalysts (Have {owned})"}

        # Perform Upgrade Roll
        rate = cls.get_success_rate(target_item.enhancement_level)
        roll = random.randint(1, 100)
        is_success = roll <= rate

        if is_success:
            cls.consume_catalysts(player, cost)
            item = target_item # Alias
            item.enhancement_level += 1
            cls.apply_stats_bonus(item)
            
            # Awakening Check
            new_buff = None
            if item.enhancement_level % 3 == 0:
                new_buff = cls.roll_awakening(item)
            
            # Recalculate player stats if equipped
            if in_equipment:
                player.calculate_stats()
                
            msg = f"Upgrade Successful! (+{item.enhancement_level})"
            if new_buff:
                # Format friendly message
                from ..models.buff import Buff
                b_obj = Buff(**new_buff.dict())
                msg += f" \n✨ AWAKENED: {b_obj.description()}!"
                
            return {
                "success": True, 
                "message": msg,
                "new_level": item.enhancement_level,
                "item": item,
                "catalysts_consumed": cost
            }
        else:
            # Failure
            # Consume reduced amount (simulated by refunding?)
            # Logic: "Perde 50% da quantidade... para o item"
            # Means we consume 50% of the COST. (or consume all and refund 50%?)
            penalty_pct = cls.config["failure_penalty_percent"] / 100.0
            consumed = int(cost * penalty_pct)
            if consumed < 1: consumed = 1 # Minimum 1
            
            cls.consume_catalysts(player, consumed)
            
            return {
                "success": False, 
                "message": "Upgrade Failed...",
                "item": target_item,
                "catalysts_consumed": consumed
            }

    @classmethod
    def apply_stats_bonus(cls, item: Item):
        # We now calculate stats dynamically in Player.calculate_stats to avoid rounding errors and accumulation drift.
        # This method is kept for compatibility or advanced one-off mutations if needed, but for standard enhancement we do nothing to base stats.
        pass

    @classmethod
    def roll_awakening(cls, item: Item):
        """Rolls a random buff and adds it to the item's awakenings."""
        from ..models.buff import Buff, BuffType
        
        # 1. Define Pool
        # For now, uniform distribution. Later can add weights to Config.
        pool = [
            (BuffType.PERCENT_ATK, 0.01, 0.05),   # 1% - 5%
            (BuffType.PERCENT_DEF, 0.01, 0.05),
            (BuffType.PERCENT_HP,  0.01, 0.05),
            (BuffType.CRIT_RATE,   0.01, 0.03),   # 1% - 3%
            (BuffType.CRIT_DMG,    0.05, 0.10),   # 5% - 10%
            (BuffType.LIFESTEAL,   0.01, 0.02)    # 1% - 2%
        ]
        
        # 2. Select Buff Type
        selected = random.choice(pool)
        b_type, min_val, max_val = selected
        
        # 3. Roll Value
        val = random.uniform(min_val, max_val)
        val = round(val, 3) # Round to 3 decimal places (e.g. 0.035 = 3.5%)
        
        # 4. Create Buff
        buff = Buff(type=b_type, value=val)
        
        # 5. Add to Item (Append only, or stack?)
        # For awakenings, we usually append new slots.
        # Check duplicate constraints? For now, allow duplicates (stacking stats).
        item.awakenings.append(buff.dict())
        
        return buff

# Initialize config
UpgradeService.load_config()
