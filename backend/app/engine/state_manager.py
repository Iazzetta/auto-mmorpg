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
            # Map ID -> List of Monster IDs
            cls._instance.map_monsters: Dict[str, List[str]] = {} 
        return cls._instance

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls()
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
                to_respawn.append(item)
            else:
                remaining.append(item)
        
        self.respawn_queue = remaining
        return to_respawn
