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
        import time
        self.running = True
        self.last_tick_time = time.time()
        while self.running:
            await self.tick()
            await asyncio.sleep(0.05) 

    async def tick(self):
        import time
        current_time = time.time()
        dt = current_time - self.last_tick_time
        self.last_tick_time = current_time
        
        if dt > 0.5: dt = 0.5
        
        # Performance Logging
        if not hasattr(self, 'tick_count'): self.tick_count = 0
        self.tick_count += 1
        
        if self.tick_count % 100 == 0:
            player_count = len(self.state_manager.players)
            monster_count = len(self.state_manager.monsters)
            respawn_count = len(getattr(self.state_manager, 'respawn_queue', []))
            print(f"[PERF] Tick: {self.tick_count} | FPS: {1/dt:.2f} | Players: {player_count} | Monsters: {monster_count} | RespawnQueue: {respawn_count}")

        movement_updates = []

        # Iterate over all players
        for player_id, player in self.state_manager.players.items():
            if not player.is_online: continue
            
            if player.state == PlayerState.COMBAT:
                # Combat Logic (Keep immediate broadcast for responsiveness)
                attack_cooldown = getattr(player.stats, 'attack_cooldown', 1.0)
                if not hasattr(player, 'last_attack_time'): player.last_attack_time = 0
                
                if current_time - player.last_attack_time >= attack_cooldown:
                    player.last_attack_time = current_time
                    if player.target_monster_id:
                        monster = self.state_manager.monsters.get(player.target_monster_id)
                        if monster:
                            import math
                            dist = math.sqrt((player.position.x - monster.position_x)**2 + (player.position.y - monster.position_y)**2)
                            if dist > 2.5:
                                player.state = PlayerState.IDLE
                                player.target_monster_id = None
                                continue

                            log = CombatService.process_combat_round(player, monster)
                            if not log:
                                player.state = PlayerState.IDLE
                                player.target_monster_id = None
                                continue
                            
                            if hasattr(self, 'connection_manager'):
                                await self.connection_manager.broadcast({
                                    "type": "combat_update",
                                    "player_id": player_id,
                                    "monster_id": monster.id,
                                    "log": log,
                                    "player_hp": player.stats.hp,
                                    "monster_hp": monster.stats.hp,
                                    "monster_max_hp": monster.stats.max_hp,
                                    "monster_name": monster.name,
                                    "drops": log.get('drops', [])
                                })

                            if log.get('monster_died'):
                                player.state = PlayerState.IDLE
                                player.target_monster_id = None
                                self.state_manager.remove_monster(monster.id)
                            
                            if log.get('player_died'):
                                player.state = PlayerState.IDLE
                                player.target_monster_id = None
                                player.death_time = current_time
                        else:
                            player.state = PlayerState.IDLE
                            player.target_monster_id = None
                
                # Broadcast state (Combat or potentially Idle now)
                movement_updates.append({
                    "id": player.id,
                    "type": "player",
                    "x": player.position.x,
                    "y": player.position.y,
                    "state": player.state,
                    "target_id": player.target_monster_id,
                    "map_id": player.current_map_id
                })
            
            elif player.state == PlayerState.MOVING and player.target_position:
                reached = MovementService.move_towards_target(player, player.target_position.x, player.target_position.y, dt)
                
                if reached:
                    player.state = PlayerState.IDLE
                    player.target_position = None
                
                # Add to batch
                movement_updates.append({
                    "id": player.id,
                    "type": "player",
                    "x": player.position.x,
                    "y": player.position.y,
                    "state": player.state,
                    "target_id": player.target_monster_id,
                    "map_id": player.current_map_id
                })
        
        # Process Monsters (AI)
        monster_updates = await self.process_monsters(dt)
        movement_updates.extend(monster_updates)

        # Broadcast Batch Updates
        if movement_updates and hasattr(self, 'connection_manager'):
            # Throttle updates? No, batching is already throttling frequency by tick rate.
            # But we can limit to 20 FPS updates if tick is 60 FPS.
            # For now, send every tick (20 FPS target in start loop).
            await self.connection_manager.broadcast({
                "type": "batch_update",
                "entities": movement_updates
            })

        # Check Respawns
        to_respawn = self.state_manager.check_respawns()
        for data in to_respawn:
            import uuid
            from ..models.monster import Monster
            template = self.state_manager.monster_templates.get(data['template_id'])
            if template:
                new_monster = Monster(
                    id=f"{data['template_id']}_{uuid.uuid4().hex[:8]}",
                    template_id=data['template_id'],
                    name=template['name'],
                    level=template['level'],
                    m_type=template['m_type'],
                    stats=template['stats'].copy(),
                    map_id=data['map_id'],
                    position_x=data['x'],
                    position_y=data['y'],
                    spawn_x=data['x'],
                    spawn_y=data['y'],
                    xp_reward=template['xp_reward']
                )
                self.state_manager.add_monster(new_monster)
                if hasattr(self, 'connection_manager'):
                    asyncio.create_task(self.connection_manager.broadcast({
                        "type": "monster_respawn",
                        "monster": new_monster.dict()
                    }))

    async def process_monsters(self, dt: float):
        import math
        import random
        import time
        current_time = time.time()
        
        updates = []
        
        for monster_id, monster in self.state_manager.monsters.items():
            if monster.stats.hp <= 0: continue
            
            moved = False
            initial_state = monster.state
            
            # AI Logic
            target = None
            if monster.target_id:
                target = self.state_manager.get_player(monster.target_id)
                if not target or str(target.current_map_id) != str(monster.map_id) or target.stats.hp <= 0:
                    monster.target_id = None
                    monster.state = "RETURNING"
                    target = None
            
            if monster.m_type == "aggressive" and not target and monster.state in ["IDLE", "WANDERING"]:
                closest_dist = monster.aggro_range
                closest_p = None
                for p in self.state_manager.players.values():
                    if str(p.current_map_id) == str(monster.map_id) and p.stats.hp > 0:
                        dist = math.sqrt((p.position.x - monster.position_x)**2 + (p.position.y - monster.position_y)**2)
                        if dist < closest_dist:
                            closest_dist = dist
                            closest_p = p
                if closest_p:
                    monster.target_id = closest_p.id
                    monster.state = "CHASING"
                    target = closest_p

            # State Machine
            if monster.state == "IDLE":
                if random.random() < 0.02:
                    angle = random.random() * 2 * math.pi
                    r = random.random() * 4.0
                    wx = monster.spawn_x + r * math.cos(angle)
                    wy = monster.spawn_y + r * math.sin(angle)
                    wx = max(1, min(99, wx))
                    wy = max(1, min(99, wy))
                    monster.wander_target_x = wx
                    monster.wander_target_y = wy
                    monster.state = "WANDERING"
            
            elif monster.state == "WANDERING":
                if monster.wander_target_x is not None:
                    dx = monster.wander_target_x - monster.position_x
                    dy = monster.wander_target_y - monster.position_y
                    dist = math.sqrt(dx*dx + dy*dy)
                    if dist < 0.5:
                        monster.state = "IDLE"
                        monster.wander_target_x = None
                        monster.wander_target_y = None
                    else:
                        speed = getattr(monster.stats, 'speed', 10.0) * dt * 0.3
                        monster.position_x += (dx/dist) * speed
                        monster.position_y += (dy/dist) * speed
                        moved = True
            
            elif monster.state == "CHASING":
                if target:
                    dist_from_spawn = math.sqrt((monster.position_x - monster.spawn_x)**2 + (monster.position_y - monster.spawn_y)**2)
                    if dist_from_spawn > monster.leash_range:
                        monster.target_id = None
                        monster.state = "RETURNING"
                    else:
                        dx = target.position.x - monster.position_x
                        dy = target.position.y - monster.position_y
                        dist = math.sqrt(dx*dx + dy*dy)
                        if dist <= 1.5:
                            monster.state = "ATTACKING"
                        else:
                            speed = getattr(monster.stats, 'speed', 10.0) * dt
                            if dist > 0:
                                monster.position_x += (dx/dist) * speed
                                monster.position_y += (dy/dist) * speed
                                moved = True

            elif monster.state == "ATTACKING":
                if target:
                    dist = math.sqrt((target.position.x - monster.position_x)**2 + (target.position.y - monster.position_y)**2)
                    if dist > 2.0:
                        monster.state = "CHASING"
                    else:
                        if target.state != PlayerState.COMBAT:
                            target.state = PlayerState.COMBAT
                        
                        # Auto-target if none (Self Defense)
                        if not target.target_monster_id:
                            target.target_monster_id = monster.id

                        # Monster Attack (Damage)
                        if current_time - monster.last_attack_time >= 2.0:
                            monster.last_attack_time = current_time
                            from ..services.combat_service import CombatService
                            log = CombatService.monster_attack(monster, target)
                            
                            if log and hasattr(self, 'connection_manager'):
                                await self.connection_manager.broadcast({
                                    "type": "combat_update",
                                    "player_id": target.id,
                                    "monster_id": monster.id,
                                    "log": log,
                                    "player_hp": target.stats.hp,
                                    "monster_hp": monster.stats.hp,
                                    "monster_max_hp": monster.stats.max_hp,
                                    "monster_name": monster.name
                                })
                else:
                    monster.state = "IDLE"

            elif monster.state == "RETURNING":
                dx = monster.spawn_x - monster.position_x
                dy = monster.spawn_y - monster.position_y
                dist = math.sqrt(dx*dx + dy*dy)
                if dist < 0.5:
                    monster.position_x = monster.spawn_x
                    monster.position_y = monster.spawn_y
                    monster.state = "IDLE"
                else:
                    speed = getattr(monster.stats, 'speed', 10.0) * dt * 1.5
                    if dist > 0:
                        monster.position_x += (dx/dist) * speed
                        monster.position_y += (dy/dist) * speed
                        moved = True
            
            # Send update if moved OR state changed
            if moved or monster.state != initial_state:
                updates.append({
                    "id": monster.id,
                    "type": "monster",
                    "x": monster.position_x,
                    "y": monster.position_y,
                    "state": monster.state,
                    "map_id": monster.map_id
                })
                
        return updates
            

