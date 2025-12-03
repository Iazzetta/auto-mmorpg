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
            await asyncio.sleep(0.5) # 0.5s Server Tick

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
                                "monster_hp": monster.stats.hp
                            })

                        if log.get('monster_died'):
                            player.state = PlayerState.IDLE
                            player.target_monster_id = None
                            self.state_manager.remove_monster(monster.id)
                    else:
                        # Monster gone
                        player.state = PlayerState.IDLE
                        player.target_monster_id = None
        
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
            
            elif player.state == PlayerState.MOVING:
                # Handle movement
                # We need a target position. 
                # For this prototype, let's assume we move towards (10, 10) if moving
                # In a real app, we'd have a destination queue.
                pass
