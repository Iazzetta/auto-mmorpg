import json
import os

# Configuration
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/app/data"))

def save_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=4)
    print(f"Reset {filename}")

def reset_world():
    print(f"--- Resetting World Data in {DATA_DIR} ---")
    
    # 1. World (Maps) - Minimal Castle
    world_data = {
        "maps": {
            "map_castle_1": {
                "name": "Castle",
                "type": "safe",
                "level_requirement": 0,
                "width": 100,
                "height": 100,
                "respawn_x": 50,
                "respawn_y": 50,
                "portals": [],
                "spawns": [],
                "texture": "floor/Brickwall2_Texture.png",
                "resources": [],
                "texture_scale": 34
            }
        },
        "monster_templates": {}, 
        "resource_templates": {}
    }
    save_json("world.json", world_data)

    # 2. Items - Basic Set
    items_data = {
        "item_sword_01": {
            "name": "Wooden Sword",
            "type": "weapon",
            "slot": "hand_main",
            "rarity": "common",
            "stats": {"atk": 2, "crit_rate": 0.05, "crit_dmg": 0.5},
            "power_score": 1,
            "icon": "⚔️",
            "stackable": False
        },
         "item_potion_hp_01": {
            "name": "Health Potion",
            "type": "consumable",
            "slot": "none",
            "rarity": "common",
            "stats": {"hp": 50},
            "power_score": 5,
            "icon": "🧪",
            "stackable": True
        }
    }
    save_json("items.json", items_data)

    # 3. Missions - Empty or Welcome
    missions_data = {}
    save_json("missions.json", missions_data)
    
    # 4. Rewards
    rewards_data = [] # List format based on previous file
    save_json("rewards.json", {"rewards": []})

    # 5. NPCs
    save_json("npcs.json", {})

    print("--- World Destruction Complete. Clean Slate. ---")

if __name__ == "__main__":
    confirm = input("Are you SURE you want to DELETE the current world? (type 'delete'): ")
    if confirm == "delete":
        reset_world()
    else:
        print("Aborted.")
