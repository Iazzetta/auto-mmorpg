from ..models.player import Player
from ..models.item import Item, ItemSlot

class InventoryService:
    
    @staticmethod
    def add_item(player: Player, item: Item):
        """
        Adds an item to the player's inventory.
        Triggers auto-equip logic.
        """
        # Check for stacking
        if item.stackable:
            for existing_item in player.inventory:
                if existing_item.name == item.name and existing_item.type == item.type:
                    existing_item.quantity += item.quantity
                    return

        # Auto-equip logic (only for equipment)
        if item.slot != ItemSlot.NONE:
            current_equipped = player.equipment.get(item.slot)
            
            should_equip = False
            if current_equipped is None:
                should_equip = True
            elif item.power_score > current_equipped.power_score:
                should_equip = True
            
            if should_equip:
                InventoryService.equip_item(player, item)
            else:
                player.inventory.append(item)
        else:
            player.inventory.append(item)
            
        # Check for Collect Missions
        InventoryService.check_mission_progress(player, item)

    @staticmethod
    def check_mission_progress(player: Player, item: Item):
        from ..engine.state_manager import StateManager
        state_manager = StateManager.get_instance()
        
        if not player.active_mission_id:
            return
            
        mission = state_manager.missions.get(player.active_mission_id)
        if not mission:
            return
            
        m_type = mission.get("type", "kill")
        target_item = mission.get("target_template_id")
        
        # Extract template ID (assuming format template_id_uuid)
        # This is a bit hacky, but without changing Item model schema (which might break DB/frontend), 
        # we can try to match the start of the ID.
        # Ideally we should add template_id to Item.
        
        if m_type == "collect" and target_item and item.id.startswith(target_item):
             player.mission_progress += item.quantity
             # Check completion
             if player.mission_progress >= mission.get("target_count", 1):
                 # Auto-complete or just notify?
                 # Usually manual claim.
                 pass

    @staticmethod
    def equip_item(player: Player, item: Item):
        """
        Equips an item, moving the old one to inventory.
        """
        slot = item.slot
        old_item = player.equipment.get(slot)
        
        if old_item:
            player.inventory.append(old_item)
            # Remove stats from old item
            player.stats.atk -= old_item.stats.atk
            player.stats.def_ -= old_item.stats.def_
            player.stats.speed -= 0 # Assuming items don't give speed for now, but good to have placeholder
            
        player.equipment[slot] = item
        
        # Add stats from new item
        player.stats.atk += item.stats.atk
        player.stats.def_ += item.stats.def_
        # Recalculate other derived stats if necessary
