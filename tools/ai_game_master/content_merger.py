import json
import os
import time

class ContentMerger:
    def __init__(self, data_dir):
        self.data_dir = data_dir

    def merge_and_save(self, generated_data, current_loader):
        # 1. Merge World (Maps, Monster Templates)
        if "maps" in generated_data:
            current_loader.world.setdefault("maps", {}).update(generated_data["maps"])
        
        if "monster_templates" in generated_data:
            # Update world.json monster templates
            current_loader.world.setdefault("monster_templates", {}).update(generated_data["monster_templates"])

        # 2. Merge Items
        if "items" in generated_data:
            current_loader.items.update(generated_data["items"])

        # 3. Merge Missions
        if "missions" in generated_data:
             current_loader.missions.update(generated_data["missions"])
             
        # 4. Merge NPCs
        if "npcs" in generated_data:
             if not hasattr(current_loader, "npcs"):
                 # Lazy init if loader doesn't have it (it should if updated)
                 current_loader.npcs = {}
             current_loader.npcs.update(generated_data["npcs"])

        # --- VALIDATION & CLEANUP ---
        # Remove missions that point to non-existent maps (Self-Healing)
        all_maps = set(current_loader.world.get("maps", {}).keys())
        
        missions_to_remove = []
        for m_id, mission in current_loader.missions.items():
            # Check explicit map_id
            if "map_id" in mission:
                if mission["map_id"] and mission["map_id"] not in all_maps:
                    print(f"Removing broken mission {m_id} (Invalid Map: {mission['map_id']})")
                    missions_to_remove.append(m_id)
                    continue
            
            # Check target NPC map (if talk type)
            if mission.get("type", "") == "talk":
                target_npc_id = mission.get("target_npc_id")
                if target_npc_id and target_npc_id in current_loader.npcs:
                    npc = current_loader.npcs[target_npc_id]
                    if npc.get("map_id") and npc["map_id"] not in all_maps:
                         print(f"Removing broken mission {m_id} (NPC in Invalid Map: {npc['map_id']})")
                         missions_to_remove.append(m_id)

        for m_id in missions_to_remove:
            del current_loader.missions[m_id]

        # 5. Save to Files
        self.save_json("world.json", current_loader.world)
        self.save_json("items.json", current_loader.items)
        self.save_json("missions.json", current_loader.missions)
        self.save_json("npcs.json", current_loader.npcs)
        
        print("Content merged and saved successfully.")

    def save_json(self, filename, data):
        path = os.path.join(self.data_dir, filename)
        # Backup
        if os.path.exists(path):
            backup_path = path + f".bak_{int(time.time())}"
            try:
                os.rename(path, backup_path)
            except Exception as e:
                print(f"Backup failed for {filename}: {e}")

        with open(path, "w") as f:
            json.dump(data, f, indent=4)
