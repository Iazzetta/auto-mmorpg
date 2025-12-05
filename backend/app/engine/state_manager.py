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
        return cls._instance

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
            
            # Load Maps
            for map_id, map_data in data.get("maps", {}).items():
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
                    spawns=map_data.get("spawns", [])
                )
                self.maps[map_id] = gm
                
                # Initial Spawns
                for spawn in map_data.get("spawns", []):
                    self.spawn_monsters_from_template(spawn, map_id)
                    
        except Exception as e:
            print(f"Failed to load world data: {e}")

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
