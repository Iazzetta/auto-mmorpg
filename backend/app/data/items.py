from ..models.item import ItemType, ItemSlot, ItemRarity, ItemStats

import json
import os
from ..models.item import ItemType, ItemSlot, ItemRarity, ItemStats

# Load items from JSON
ITEMS = {}

def load_items():
    global ITEMS
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, "items.json")
    
    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            data = json.load(f)
            
        ITEMS.clear()
        for key, val in data.items():
            stats_data = val.get("stats", {})
            
            ITEMS[key] = {
                "name": val["name"],
                "type": ItemType(val["type"]),
                "slot": ItemSlot(val["slot"]),
                "rarity": ItemRarity(val["rarity"]),
                "stats": ItemStats(**stats_data),
                "power_score": val.get("power_score", 0),
                "icon": val.get("icon", "📦"),
                "stackable": val.get("stackable", False)
            }

load_items()
