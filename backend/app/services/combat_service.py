import random
from ..models.player import Player, PlayerState
from ..models.monster import Monster
from ..models.item import Item, ItemType, ItemSlot, ItemRarity, ItemStats
from .inventory_service import InventoryService

class CombatService:
    
    @staticmethod
    def calculate_damage(attacker_stats, defender_stats) -> int:
        # Handle both int (legacy/direct) and Stats objects
        atk = attacker_stats.atk if hasattr(attacker_stats, 'atk') else attacker_stats
        def_ = defender_stats.def_ if hasattr(defender_stats, 'def_') else defender_stats
        
        damage = atk - (def_ // 2)
        return max(1, damage) # Minimum 1 damage

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
        
        # Player hits Monster
        dmg_to_monster = CombatService.calculate_damage(player.stats.atk, monster.stats.def_)
        monster.stats.hp -= dmg_to_monster
        log['player_dmg'] = dmg_to_monster
        
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
            
            # Award XP
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
            
            log['next_level_xp'] = player.next_level_xp # Send next level XP for UI update
            
            # Update Mission Progress
            try:
                CombatService.check_mission_progress(player, monster)
            except Exception as e:
                print(f"[ERROR] Mission progress check failed: {e}")
            
            # Generate Loot
            try:
                CombatService.generate_loot(player, monster)
            except Exception as e:
                print(f"[ERROR] Loot generation failed: {e}")
            
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
        dmg_to_player = CombatService.calculate_damage(monster.stats, player.stats)
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
        # 1. Gold (Always drop some gold based on level/random)
        gold_amount = random.randint(10, 50) # Could be based on monster level
        player.gold += gold_amount
        
        # 2. Items (Drop System)
        from ..engine.state_manager import StateManager
        from ..data.items import ITEMS
        import uuid
        
        template = StateManager.get_instance().monster_templates.get(monster.template_id)
        if not template or "drops" not in template:
            return
            
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
