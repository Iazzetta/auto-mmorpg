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
