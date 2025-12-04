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
        
        # Player hits Monster
        dmg_to_monster = CombatService.calculate_damage(player.stats.atk, monster.stats.def_)
        monster.stats.hp -= dmg_to_monster
        log['player_dmg'] = dmg_to_monster
        
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
            CombatService.check_mission_progress(player, monster)
            
            # Generate Loot
            CombatService.generate_loot(player, monster)
            
            # Queue Respawn
            from ..engine.state_manager import StateManager
            sm = StateManager.get_instance()
            template = sm.monster_templates.get(monster.template_id)
            respawn_time = template["respawn_time"] if template else 10.0
            
            sm.queue_respawn(
                monster.template_id, 
                monster.map_id, 
                monster.position_x, 
                monster.position_y, 
                respawn_time
            )
            
            return log

        # Monster hits Player
        dmg_to_player = CombatService.calculate_damage(monster.stats, player.stats)
        player.stats.hp -= dmg_to_player
        log['monster_dmg'] = dmg_to_player
        
        if player.stats.hp <= 0:
            player.stats.hp = 0
            log['player_died'] = True
            # Handle Death
            player.state = PlayerState.IDLE
            player.target_monster_id = None
            player.stats.hp = player.stats.max_hp # Reset HP
            
            # Respawn at designated map
            from ..engine.state_manager import StateManager
            sm = StateManager.get_instance()
            respawn_map = sm.get_map(player.respawn_map_id)
            
            if respawn_map:
                player.current_map_id = respawn_map.id
                player.position.x = respawn_map.respawn_x
                player.position.y = respawn_map.respawn_y
            else:
                # Fallback
                player.current_map_id = "map_castle_1"
                player.position.x = 50
                player.position.y = 50
            
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
        from ..data.missions import MISSIONS
        
        if player.active_mission_id:
            mission = MISSIONS.get(player.active_mission_id)
            if mission:
                # Check if the killed monster matches the mission target
                if monster.template_id == mission["target_monster_id"]:
                    player.mission_progress += 1
                    
                    # Check completion (Optional: Auto-complete or just cap progress)
                    if player.mission_progress >= mission["target_count"]:
                        player.mission_progress = mission["target_count"]
                        # We could send a notification here "Mission Ready to Claim"
