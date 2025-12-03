import asyncio
from ..engine.state_manager import StateManager
from ..models.player import PlayerState
from ..services.combat_service import CombatService
from ..services.movement_service import MovementService

class GameLoop:
    def __init__(self):
        self.state_manager = StateManager.get_instance()
        self.running = False

    def set_connection_manager(self, manager):
        self.connection_manager = manager

    async def start(self):
        self.running = True
        while self.running:
            await self.tick()
            await asyncio.sleep(0.1) # 0.1s Server Tick for smoother movement

    async def tick(self):
        # Iterate over all players
        for player_id, player in self.state_manager.players.items():
            if player.state == PlayerState.COMBAT:
                if player.target_monster_id:
                    monster = self.state_manager.monsters.get(player.target_monster_id)
                    if monster:
                        log = CombatService.process_combat_round(player, monster)
                        
                        # Broadcast log
                        if hasattr(self, 'connection_manager'):
                            await self.connection_manager.broadcast({
                                "type": "combat_update",
                                "player_id": player_id,
                                "log": log,
                                "player_hp": player.stats.hp,
                                "monster_hp": monster.stats.hp,
                                "monster_name": monster.name
                            })

                        if log.get('monster_died'):
                            player.state = PlayerState.IDLE
                            player.target_monster_id = None
                            self.state_manager.remove_monster(monster.id)
                    else:
                        # Monster gone
                        player.state = PlayerState.IDLE
                        player.target_monster_id = None
            
            elif player.state == PlayerState.MOVING and player.target_position:
                # Calculate movement
                # Speed is units per second. Tick is 0.1s.
                dt = 0.1
                reached = MovementService.move_towards_target(player, player.target_position.x, player.target_position.y, dt)
                
                # Broadcast movement
                if hasattr(self, 'connection_manager'):
                    await self.connection_manager.broadcast({
                        "type": "player_moved",
                        "player_id": player.id,
                        "x": player.position.x,
                        "y": player.position.y,
                        "map_id": player.current_map_id
                    })
                
                if reached:
                    player.state = PlayerState.IDLE
                    player.target_position = None
                    
                    # Check for Portal / Map Transition
                    # Castle (map_castle_1) -> Forest (Right Edge > 90)
                    # Portal is at Y=50, radius ~15. Range 35-65.
                    if player.current_map_id == "map_castle_1" and player.position.x >= 90 and 35 <= player.position.y <= 65:
                        player.current_map_id = "map_forest_1"
                        player.position.x = 5 # Enter from Left
                        player.position.y = 50
                    
                    # Forest (map_forest_1) -> Castle (Left Edge < 10)
                    elif player.current_map_id == "map_forest_1" and player.position.x <= 10 and 35 <= player.position.y <= 65:
                        player.current_map_id = "map_castle_1"
                        player.position.x = 95 # Enter from Right
                        player.position.y = 50
                        
                    # Broadcast final position (especially if map changed)
                    if hasattr(self, 'connection_manager'):
                        await self.connection_manager.broadcast({
                            "type": "player_moved",
                            "player_id": player.id,
                            "x": player.position.x,
                            "y": player.position.y,
                            "map_id": player.current_map_id
                        })
        
        # Check Respawns
        to_respawn = self.state_manager.check_respawns()
        for data in to_respawn:
            # Create new monster instance
            import uuid
            from ..data.monsters import MONSTERS
            from ..models.monster import Monster
            
            template = MONSTERS.get(data['template_id'])
            if template:
                new_monster = Monster(
                    id=f"{data['template_id']}_{uuid.uuid4().hex[:8]}",
                    template_id=data['template_id'],
                    name=template['name'],
                    level=template['level'],
                    m_type=template['m_type'],
                    stats=template['stats'].copy(), # Important: Copy stats!
                    map_id=data['map_id'],
                    position_x=data['x'],
                    position_y=data['y'],
                    xp_reward=template['xp_reward']
                )
                self.state_manager.add_monster(new_monster)
                
                # Broadcast Respawn (Optional but good for client)
                if hasattr(self, 'connection_manager'):
                    await self.connection_manager.broadcast({
                        "type": "monster_respawn",
                        "monster": new_monster.dict()
                    })
            

