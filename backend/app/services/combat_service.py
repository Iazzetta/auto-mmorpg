import random
from ..models.player import Player, PlayerState
from ..models.monster import Monster
from ..models.item import Item, ItemType, ItemSlot, ItemRarity, ItemStats
from .inventory_service import InventoryService

class CombatService:
    
    @staticmethod
    def calculate_damage(attacker_stats, defender_stats) -> tuple[int, bool]:
        # Handle both int (legacy/direct) and Stats objects
        atk = attacker_stats.atk if hasattr(attacker_stats, 'atk') else attacker_stats
        def_ = defender_stats.def_ if hasattr(defender_stats, 'def_') else defender_stats
        
        # Crit Logic
        crit_rate = getattr(attacker_stats, 'crit_rate', 0.05) if hasattr(attacker_stats, 'crit_rate') else 0.05
        crit_dmg_mult = getattr(attacker_stats, 'crit_dmg', 0.50) if hasattr(attacker_stats, 'crit_dmg') else 0.50
        
        is_critical = random.random() < crit_rate
        
        base_damage = atk - (def_ // 2)
        base_damage = max(1, base_damage)
        
        final_damage = base_damage
        if is_critical:
            # Base damage + (Base Damage * Crit Bonus) = Base * (1 + Bonus)
            # Usually Crit Dmg is total multiplier (e.g. 150% = 1.5x) or bonus (e.g. +50%).
            # Model default is 0.50. Let's treat it as BONUS (150% total).
            final_damage = int(base_damage * (1.0 + crit_dmg_mult))
            
        return final_damage, is_critical

    @staticmethod
    def process_combat_round(player: Player, monster: Monster) -> dict:
        """
        Processes one round of combat.
        Returns a dict with combat log/events.
        """
        log = {}
        
        # Validate Combat (Same Map)
        if str(player.current_map_id) != str(monster.map_id):
            return log # No combat if different maps
        
        # Base Log Details for FCT
        log['map_id'] = player.current_map_id
        log['player_id'] = player.id
        log['monster_id'] = monster.id
        log['player_x'] = player.position.x
        log['player_y'] = player.position.y
        log['monster_x'] = monster.position_x
        log['monster_y'] = monster.position_y
        
        # Player hits Monster
        dmg_to_monster, is_crit = CombatService.calculate_damage(player.stats, monster.stats)
        monster.stats.hp -= dmg_to_monster
        log['player_dmg'] = dmg_to_monster
        if is_crit:
            log['player_crit'] = True
            
        # Lifesteal Logic
        lifesteal = player.stats.lifesteal if hasattr(player.stats, 'lifesteal') else 0.0
        
        # DEBUG LOG
        print(f"[COMBAT DEBUG] Player: {player.name} | Atk: {player.stats.atk} | Dmg: {dmg_to_monster} | Lifesteal %: {lifesteal}")
        
        if lifesteal > 0 and dmg_to_monster > 0:
            heal_amount = int(dmg_to_monster * lifesteal)
            print(f"[COMBAT DEBUG] Heal Calc: {dmg_to_monster} * {lifesteal} = {dmg_to_monster * lifesteal} -> Int: {heal_amount}")
            
            if heal_amount > 0:
                old_hp = player.stats.hp
                player.stats.hp = min(player.stats.max_hp, player.stats.hp + heal_amount)
                log['player_heal'] = heal_amount
                print(f"[COMBAT DEBUG] HP Updated: {old_hp} -> {player.stats.hp} (Max: {player.stats.max_hp})")
            else:
                print(f"[COMBAT DEBUG] Heal amount was 0 after rounding.")
        else:
            print(f"[COMBAT DEBUG] No lifesteal triggered. (LS: {lifesteal}, Dmg: {dmg_to_monster})")
        
        # Aggro Logic: If monster was passive/idle, it now fights back
        if monster.stats.hp > 0 and not monster.target_id:
            monster.target_id = player.id
            monster.state = "CHASING"
            
            # Group Aggro: Alert nearby monsters of same type
            from ..engine.state_manager import StateManager
            sm = StateManager.get_instance()
            nearby_radius = 8.0
            
            map_monsters = sm.map_monsters.get(monster.map_id, [])
            for mid in map_monsters:
                if mid == monster.id: continue
                
                other = sm.monsters.get(mid)
                if other and other.template_id == monster.template_id and other.state in ["IDLE", "WANDERING"]:
                    dist = ((other.position_x - monster.position_x)**2 + (other.position_y - monster.position_y)**2)**0.5
                    if dist <= nearby_radius:
                        other.target_id = player.id
                        other.state = "CHASING"
            
        if monster.stats.hp <= 0:
            monster.stats.hp = 0
            log['monster_died'] = True
            log['xp_gained'] = monster.xp_reward
            
            # Award XP (Refactored to use gain_xp check or inline logic with event)
            player.xp += monster.xp_reward
            
            # Level Up Check
            while player.xp >= player.next_level_xp:
                player.xp -= player.next_level_xp
                player.level += 1
                player.attribute_points += 5 # 5 points per level
                player.calculate_stats() # Recalculate stats (HP/MP might increase)
                player.stats.hp = player.stats.max_hp # Heal on level up
                log['level_up'] = True
                log['new_level'] = player.level
                
                # Broadcast Level Up Event
                try:
                    import asyncio
                    asyncio.create_task(state_manager.connection_manager.broadcast({
                        "type": "level_up",
                        "player_id": player.id,
                        "new_level": player.level
                    }))
                except Exception as e:
                    print(f"Error broadcasting level up: {e}")
            
            log['next_level_xp'] = player.next_level_xp # Send next level XP for UI update
            
            # Update Mission Progress
            try:
                CombatService.check_mission_progress(player, monster)
            except Exception as e:
                print(f"[ERROR] Mission progress check failed: {e}")
            
            # Generate Loot
            try:
                drops, gold = CombatService.generate_loot(player, monster)
                log['drops'] = drops
                log['gold_gained'] = gold
            except Exception as e:
                print(f"[ERROR] Loot generation failed: {e}")
                log['drops'] = []
                log['gold_gained'] = 0
            
            # Queue Respawn
            try:
                from ..engine.state_manager import StateManager
                sm = StateManager.get_instance()
                template = sm.monster_templates.get(monster.template_id)
                respawn_time = template["respawn_time"] if template else 10.0
                
                sm.queue_respawn(
                    monster.template_id, 
                    monster.map_id, 
                    monster.spawn_x, 
                    monster.spawn_y, 
                    respawn_time
                )
            except Exception as e:
                print(f"[ERROR] Respawn queueing failed: {e}")
            
            return log

        # Monster hits Player
        dmg_to_player, is_crit_m = CombatService.calculate_damage(monster.stats, player.stats)
        player.stats.hp -= dmg_to_player
        log['monster_dmg'] = dmg_to_player
        
        if player.stats.hp <= 0:
            player.stats.hp = 0
            log['player_died'] = True
            # Handle Death State
            player.state = PlayerState.IDLE
            player.target_monster_id = None
            # Do NOT respawn immediately. Client will handle UI and request respawn.
            
            return log
            
        return log

    @staticmethod
    def generate_loot(player: Player, monster: Monster):
        dropped_items = []
        
        # 1. Gold (Always drop some gold based on level/random)
        gold_amount = random.randint(10, 50) # Could be based on monster level
        player.gold += gold_amount
        
        # 2. Items (Drop System)
        from ..engine.state_manager import StateManager
        from ..data.items import ITEMS
        import uuid
        
        template = StateManager.get_instance().monster_templates.get(monster.template_id)
        if template and "drops" in template:
            for drop in template["drops"]:
                if random.random() < drop["chance"]:
                    item_template_id = drop["item_id"]
                    item_data = ITEMS.get(item_template_id)
                    
                    if item_data:
                        # Create new item instance
                        new_item = Item(
                            id=f"{item_template_id}_{uuid.uuid4().hex[:8]}",
                            name=item_data["name"],
                            type=item_data["type"],
                            slot=item_data["slot"],
                            rarity=item_data["rarity"],
                            stats=item_data["stats"].copy(),
                            power_score=item_data["power_score"],
                            icon=item_data.get("icon", "📦"),
                            stackable=item_data["type"] in ["consumable", "material"]
                        )
                        InventoryService.add_item(player, new_item)
                        dropped_items.append(new_item.dict())
        
        return dropped_items, gold_amount

    @staticmethod
    def check_mission_progress(player: Player, monster: Monster):
        from ..engine.state_manager import StateManager
        
        if player.active_mission_id:
            sm = StateManager.get_instance()
            mission = sm.missions.get(player.active_mission_id)
            
            if mission:
                # Check if the killed monster matches the mission target
                # Support both old 'target_monster_id' and new 'target_template_id'
                target_id = mission.get("target_template_id") or mission.get("target_monster_id")
                
                if monster.template_id == target_id:
                    player.mission_progress += 1
                    
                    # Check completion (Optional: Auto-complete or just cap progress)
                    if player.mission_progress >= mission["target_count"]:
                        player.mission_progress = mission["target_count"]
                        # We could send a notification here "Mission Ready to Claim"

    @staticmethod
    def monster_attack(monster: Monster, player: Player) -> dict:
        log = {}
        if str(player.current_map_id) != str(monster.map_id): return log
        
        dmg, is_crit = CombatService.calculate_damage(monster.stats, player.stats)
        player.stats.hp -= dmg
        log['monster_dmg'] = dmg
        
        if player.stats.hp <= 0:
            player.stats.hp = 0
            log['player_died'] = True
            # Handle Death State
            player.state = PlayerState.IDLE
            player.target_monster_id = None
            
        return log
