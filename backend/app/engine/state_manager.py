from typing import Dict, List
from ..models.player import Player
from ..models.map import GameMap
from ..models.monster import Monster

class StateManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StateManager, cls).__new__(cls)
            cls._instance.players: Dict[str, Player] = {}
            cls._instance.maps: Dict[str, GameMap] = {}
            cls._instance.monsters: Dict[str, Monster] = {}
            cls._instance.missions: Dict[str, dict] = {}
            # Map ID -> List of Monster IDs
            cls._instance.map_monsters: Dict[str, List[str]] = {}
            cls._instance.npcs: Dict[str, NPC] = {} # Added NPC dictionary
            cls._instance.respawn_queue: List[dict] = [] # Initialize respawn_queue here
            cls._instance.resource_cooldowns: Dict[str, float] = {}
        return cls._instance

    def is_resource_ready(self, resource_id: str) -> bool:
        import time
        return time.time() >= self.resource_cooldowns.get(resource_id, 0)

    def set_resource_cooldown(self, resource_id: str, duration: int):
        import time
        self.resource_cooldowns[resource_id] = time.time() + duration

    def load_missions(self):
        import json
        import os
        
        try:
            path = "backend/app/data/missions.json"
            if not os.path.exists(path):
                print(f"Missions data not found at {path}")
                self.missions = {}
                return

            with open(path, "r") as f:
                self.missions = json.load(f)
            print(f"Loaded {len(self.missions)} missions.")
        except Exception as e:
            print(f"Failed to load missions: {e}")
            self.missions = {}

    def load_world_data(self):
        import json
        import os
        from ..models.map import GameMap
        
        try:
            # Adjust path relative to execution or use absolute
            path = "backend/app/data/world.json"
            if not os.path.exists(path):
                print(f"World data not found at {path}")
                return

            with open(path, "r") as f:
                data = json.load(f)
                
            self.world_data = data
            self.monster_templates = data.get("monster_templates", {})
            
            # Clear existing monsters and maps to prevent duplicates
            self.monsters = {}
            self.map_monsters = {}
            self.maps = {}
            self.respawn_queue = []

            # Resource Templates
            self.resource_templates = data.get("resource_templates", {})
            
            # Load Maps
            for map_id, map_data in data.get("maps", {}).items():
                
                # Expand Resources with Templates
                resources_data = map_data.get("resources", [])
                expanded_resources = []
                for res in resources_data:
                    if 'template_id' in res and res['template_id']:
                        template = self.resource_templates.get(res['template_id'])
                        if template:
                            # Merge template into res, but res overrides
                            merged = template.copy()
                            merged.update(res)
                            expanded_resources.append(merged)
                        else:
                            expanded_resources.append(res)
                    else:
                        expanded_resources.append(res)

                # Create GameMap object
                gm = GameMap(
                    id=map_id,
                    name=map_data["name"],
                    type=map_data.get("type", "field"),
                    level_requirement=map_data.get("level_requirement", 0),
                    width=map_data["width"],
                    height=map_data["height"],
                    respawn_x=map_data.get("respawn_x", 50.0),
                    respawn_y=map_data.get("respawn_y", 50.0),
                    portals=map_data.get("portals", []),
                    spawns=map_data.get("spawns", []),
                    texture=map_data.get("texture"),
                    resources=expanded_resources
                )
                self.maps[map_id] = gm
                
                # Initial Spawns
                for spawn in map_data.get("spawns", []):
                    self.spawn_monsters_from_template(spawn, map_id)
            
            self.load_npcs()
                    
        except Exception as e:
            print(f"Failed to load world data: {e}")

    def load_npcs(self):
        import json
        import os
        from ..models.npc import NPC
        
        try:
            path = "backend/app/data/npcs.json"
            if not os.path.exists(path):
                print(f"NPC data not found at {path}")
                self.npcs = {}
                return
            
            with open(path, "r") as f:
                data = json.load(f)
                self.npcs = {k: NPC(**v) for k, v in data.items()}
            print(f"Loaded {len(self.npcs)} NPCs.")
        except Exception as e:
            print(f"Failed to load NPCs: {e}")
            self.npcs = {}

    def spawn_monsters_from_template(self, spawn_config, map_id):
        import uuid
        import random
        from ..models.monster import Monster
        
        template_id = spawn_config["template_id"]
        count = spawn_config["count"]
        area = spawn_config["area"]
        
        template = self.monster_templates.get(template_id)
        if not template:
            return

        for _ in range(count):
            # Random position in area
            # area: {x, y, radius}
            # Simple random in circle
            import math
            angle = random.random() * 2 * math.pi
            r = math.sqrt(random.random()) * area["radius"]
            x = area["x"] + r * math.cos(angle)
            y = area["y"] + r * math.sin(angle)
            
            # Clamp
            x = max(0, min(100, x))
            y = max(0, min(100, y))
            
            new_monster = Monster(
                id=f"{template_id}_{uuid.uuid4().hex[:8]}",
                template_id=template_id,
                name=template["name"],
                level=template["level"],
                m_type=template["m_type"],
                stats=template["stats"].copy(), # Important: Copy stats!
                map_id=map_id,
                position_x=x,
                position_y=y,
                spawn_x=x,
                spawn_y=y,
                xp_reward=template["xp_reward"]
            )
            self.add_monster(new_monster)

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls()
            cls._instance.load_world_data() # Load data on init
            cls._instance.load_missions()   # Load missions on init
        return cls._instance

    def add_player(self, player: Player):
        self.players[player.id] = player

    def remove_player(self, player_id: str):
        if player_id in self.players:
            # Persistent world: Do not remove player data from memory on disconnect.
            # Just ensure they stop actions.
            player = self.players[player_id]
            # Use string "idle" or Enum if possible, python is flexible here usually, but strictly:
            from ..models.player import PlayerState
            player.state = PlayerState.IDLE
            player.target_position = None
            # Do NOT delete: self.players[player_id]

    def get_player(self, player_id: str) -> Player:
        return self.players.get(player_id)

    def add_map(self, game_map: GameMap):
        self.maps[game_map.id] = game_map

    def get_map(self, map_id: str) -> GameMap:
        return self.maps.get(map_id)
    
    def add_monster(self, monster: Monster):
        self.monsters[monster.id] = monster
        if monster.map_id not in self.map_monsters:
            self.map_monsters[monster.map_id] = []
        self.map_monsters[monster.map_id].append(monster.id)

    def remove_monster(self, monster_id: str):
        if monster_id in self.monsters:
            monster = self.monsters[monster_id]
            if monster.map_id in self.map_monsters:
                self.map_monsters[monster.map_id].remove(monster_id)
            del self.monsters[monster_id]

    # Respawn System
    def queue_respawn(self, monster_template_id: str, map_id: str, x: float, y: float, respawn_time: float):
        # We need to store when it should respawn
        import time
        respawn_at = time.time() + respawn_time
        if not hasattr(self, 'respawn_queue'):
            self.respawn_queue = []
        
        print(f"[DEBUG_RESPAWN] Queuing respawn for {monster_template_id} on {map_id} at ({x:.1f}, {y:.1f}) in {respawn_time}s")
        
        self.respawn_queue.append({
            "template_id": monster_template_id,
            "map_id": map_id,
            "x": x,
            "y": y,
            "respawn_at": respawn_at
        })

    def check_respawns(self):
        if not hasattr(self, 'respawn_queue'):
            return []
        
        import time
        now = time.time()
        to_respawn = []
        remaining = []
        
        for item in self.respawn_queue:
            if now >= item['respawn_at']:
                print(f"[DEBUG_RESPAWN] Respawning {item['template_id']} on {item['map_id']}")
                to_respawn.append(item)
            else:
                remaining.append(item)
        
        self.respawn_queue = remaining
        return to_respawn
