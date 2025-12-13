import json
import os

# Configuration
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/app/data"))

def normalize_items():
    print(f"--- Normalizing Items in {DATA_DIR} ---")
    
    path = os.path.join(DATA_DIR, "items.json")
    try:
        with open(path, "r") as f:
            items = json.load(f)
    except Exception as e:
        print(f"Failed to load items.json: {e}")
        return

    fixed_count = 0
    for item_id, item in items.items():
        # Fix Type
        if "type" in item:
            original = item["type"]
            normalized = original.lower()
            if original != normalized:
                item["type"] = normalized
                fixed_count += 1
        
        # Fix Slot
        if "slot" in item:
            original = item["slot"]
            normalized = original.lower()
            if original != normalized:
                item["slot"] = normalized
                fixed_count += 1

        # Fix Rarity
        if "rarity" in item:
            original = item["rarity"]
            normalized = original.lower()
            if original != normalized:
                item["rarity"] = normalized
                fixed_count += 1
                
    with open(path, "w") as f:
        json.dump(items, f, indent=4)
        
    print(f"Fixed {fixed_count} issues in items.json.")

if __name__ == "__main__":
    normalize_items()
