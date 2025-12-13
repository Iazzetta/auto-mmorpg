import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel
from google.oauth2 import service_account
from typing import Dict, Any

class GeminiClient:
    def __init__(self, credentials_path: str = None, project_id: str = None, location: str = "us-central1"):
        # If credentials file provided, use it
        if credentials_path and os.path.exists(credentials_path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
            # Try to infer project_id from file if not provided
            if not project_id:
                try:
                    with open(credentials_path, "r") as f:
                        data = json.load(f)
                        project_id = data.get("project_id")
                except:
                    pass
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        target_model_name = "gemini-2.5-pro"
        try:
            # Try user requested model first
            self.model = GenerativeModel(target_model_name)
        except Exception as e:
            print(f"Warning: Failed to load '{target_model_name}' (Error: {e}).")
            print("Falling back to 'gemini-1.5-pro-preview-0409' (Stable)...")
            try:
                self.model = GenerativeModel("gemini-1.5-pro-preview-0409")
            except:
                 self.model = GenerativeModel("gemini-1.0-pro")

    def generate_content_updates(self, current_state: Dict[str, Any], target_level_range: tuple, theme: str = "") -> Dict[str, Any]:
        """
        Generates new maps, monsters, items, and missions.
        """
        
        start_lvl, end_lvl = target_level_range
        
        prompt = f"""
        You are an AI Game Master for an MMORPG. 
        Your task is to generate valid JSON data for the next expansion of the game.
        
        **Context:**
        - Current Max Level: {start_lvl}
        - Target Expansion Level: {end_lvl}
        - Theme: {theme if theme else "Logical continuation of current zones"}
        
        **CRITICAL DATA RULES (STRICT COMPLIANCE REQUIRED):**
        1. **Enums are strictly LOWERCASE**. valid values:
           - ItemType: "weapon", "armor", "material", "consumable", "junk"
           - ItemSlot: "head", "chest", "legs", "boots", "hand_main", "hand_off", "none" (MUST use "none" for materials/consumables)
           - ItemRarity: "common", "uncommon", "rare", "epic", "legendary"
           - MissionType: "kill", "delivery", "talk", "collect"

        2. **Map/Portal Schema**:
           At "maps" key. Use Map ID as key.
           {{
             "map_id": {{
                "name": "Map Name",
                "type": "field",      <-- "field", "dungeon", "safe" (Castle is safe)
                "level_requirement": 1,
                "width": 100, "height": 100,
                "respawn_x": 50, "respawn_y": 50,
                "texture": "floor/Grass_Texture.png", <-- Required
                "portals": [
                    {{
                        "id": "portal_to_next",
                        "x": 90, "y": 50,            <-- Location in CURRENT map
                        "target_map_id": "next_map", <-- Destination Map ID
                        "target_x": 10, "target_y": 50, <-- Landing spot in DESTINATION
                        "label": "To Next Map",
                        "color": "#32CD32"           <-- REQUIRED Hex Color (Green: #32CD32, Red: #FF4500)
                    }}
                ],
                "spawns": [ {{ "template_id": "mob_id", "area": {{ "x": 50, "y": 50, "radius": 10 }}, "count": 1 }} ],
                "resources": []
             }}
           }}

        3. **Items Schema**:
           At the root "items" key, use ID as key.
           {{
             "item_id": {{
               "name": "Item Name",
               "type": "weapon",
               "slot": "hand_main",    <-- REQUIRED. Use "none" if not equippable.
               "rarity": "common",
               "stats": {{ "atk": 10, ... }},
               "power_score": 10,
               "icon": "⚔️", 
               "stackable": false
             }}
           }}

        4. **Monsters Schema**:
           At "monster_templates" key.
           {{
             "monster_id": {{
               "id": "monster_id",
               "name": "Name",
               "level": 10,
               "m_type": "aggressive",
               "stats": {{ "hp": 100, "max_hp": 100, "atk": 10, "def_": 5, "speed": 5, "attack_cooldown": 2 }},
               "xp_reward": 50,
               "drops": [ {{ "item_id": "item_id", "chance": 0.5 }} ],
               "respawn_time": 10
             }}
           }}

        5. **Missions Schema (CRITICAL)**:
           At "missions" key.
           {{
             "mission_id": {{
                "id": "mission_id",
                "title": "Title",
                "description": "Desc",
                "level_requirement": 1, 
                "type": "kill",          <-- REQUIRED (kill, delivery, talk, collect)
                "is_main_quest": true,
                "source": "npc",
                
                "target_template_id": "monster_id",  <-- REQUIRED if type=kill
                "target_item_id": "item_id",         <-- REQUIRED if type=delivery/collect
                "target_npc_id": "npc_id",           <-- REQUIRED if type=talk
                "target_count": 5,                   
                
                "rewards": {{ 
                    "xp": 100, 
                    "gold": 50, 
                    "items": [ {{ "item_id": "id", "quantity": 1 }} ] 
                }},
                "next_mission_id": "next_mission_id"
             }}
           }}
           
        6. **NPCs Schema (CRITICAL)**:
           At "npcs" key.
           {{
             "npc_id": {{
                "id": "npc_id",
                "name": "NPC Name",
                "x": 50, "y": 50,
                "map_id": "map_id",     <-- CRITICAL: Must match a Map ID exactly
                "type": "quest_giver",  <-- or "merchant"
                "icon": "👤",
                "dialogue": ["Hello!", "I have a task for you."], <-- List of strings
                "quest_id": "mission_id", <-- CRITICAL: Must match a Mission ID exactly to give quest
                "shop_items": []
             }}
           }}

        **Current World Summary:**
        - Last Maps: {list(current_state['world']['maps'].keys())[-3:] if 'maps' in current_state['world'] else []}
        
        **Requirements:**
        1. Create 3 New Maps (connected in a chain).
           - **CRITICAL:** You MUST include 'map_castle_1' in your output to ADD a portal to the first new map.
           - Map 1: 'map_training_grounds' (Level 1-5) -> Connects to 'map_castle_1'
           - Map 2: 'map_forest_path' (Level 5-10) -> Connects to Map 1
           - Map 3: 'map_dark_cave' (Level 10-15) -> Connects to Map 2
           - Ensure Portals are BIDIRECTIONAL (Back and Forth).
           - Ensure Portals have valid "color".
        
        2. Create NPCs:
           - **CRITICAL:** Create 'npc_commander_thorne' in 'map_castle_1' at (50, 40). He gives 'mission_tutorial_1'.
           - Create NPCs in the new maps (Quest Givers).

        3. Create Missions:
           - 'mission_tutorial_1': Talk to 'npc_commander_thorne' (or Kill 5 Rats).
           - Chain missions logically.

        4. Create Monsters & Items appropriate for these levels.
        
        **Output Format:**
        Return ONLY valid JSON with this structure:
        {{
            "maps": {{ ... }},
            "monster_templates": {{ ... }},
            "items": {{ ... }},
            "missions": {{ ... }},
            "npcs": {{ ... }}
        }}
        """
        
        try:
            response = self.model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            return json.loads(response.text)
        except Exception as e:
            print(f"Error generating content: {e}")
            return {}
