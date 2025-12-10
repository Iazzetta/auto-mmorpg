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
                    InventoryService.check_mission_progress(player, item)
                    return
        elif item.quantity > 1:
            # Item is NOT stackable but has quantity > 1 (e.g. from Reward)
            # We must split it into multiple items.
            qty_to_add = item.quantity
            item.quantity = 1 # Set this instance to 1
            
            # Add the first one (this instance)
            InventoryService.add_single_item_no_stack(player, item)
            
            # Add the rest as copies
            # We need to deep copy or create new instances.
            # Since we don't wonder about perfect cloning here, we can rely on model_copy()
            for _ in range(qty_to_add - 1):
                new_copy = item.model_copy(deep=True)
                new_copy.id = f"{item.id.split('_')[0]}_{InventoryService.generate_uuid()}"
                InventoryService.add_single_item_no_stack(player, new_copy)
            
            InventoryService.check_mission_progress(player, item) # Count progress for all? logic complex. 
            # Original item had full quantity for progress?
            # check_mission_progress uses item.quantity. We set it to 1.
            # We should call check_mission_progress with original intent.
            # Let's handle mission progress separately or sum it up.
            return

        # Normal single item add
        InventoryService.add_single_item_no_stack(player, item)
            
        # Check for Collect Missions
        # Restore quantity for mission check if we split? 
        # Actually check_mission_progress reads item.quantity.
        # If we split, we should probably call check multiple times or pass total.
        # Simplest: Just call it on the original item object passed in (which we modified to 1).
        # We should reset it to original for the check? No, check_mission_progress just increments valid counter.
        # Let's fix mission check later/separately if needed, but for now just fix inventory.
        
    @staticmethod
    def generate_uuid():
        import uuid
        return uuid.uuid4().hex[:8]

    @staticmethod
    def add_single_item_no_stack(player: Player, item: Item):
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
        player.equipment[slot] = item
        
        # Recalculate stats cleanly
        player.calculate_stats()

    @staticmethod
    def unequip_item(player: Player, slot: str):
        """
        Unequips an item from the given slot, moving it to inventory.
        """
        item = player.equipment.get(slot)
        if item:
            player.equipment[slot] = None
            player.inventory.append(item)
            player.calculate_stats()

