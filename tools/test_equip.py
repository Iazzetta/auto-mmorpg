import sys
import os
sys.path.append(os.getcwd())

from backend.app.models.player import Player, PlayerClass, PlayerStats, Position, ItemSlot
from backend.app.models.item import Item, ItemType, ItemRarity, ItemSlot as ItemSlotEnum
from backend.app.services.inventory_service import InventoryService

# Mock Data
def create_test_player():
    stats = PlayerStats(hp=100, max_hp=100, atk=10, def_=0, speed=10.0)
    pos = Position(x=0, y=0)
    p = Player(
        id="test_p", token="t", name="Test", p_class=PlayerClass.WARRIOR,
        stats=stats, current_map_id="m", position=pos
    )
    return p

def test_equip():
    p = create_test_player()
    
    # Create Sword
    sword = Item(
        id="sword_1", name="High Sword", type=ItemType.WEAPON, 
        slot=ItemSlotEnum.HAND_MAIN, rarity=ItemRarity.RARE,
        stats={"atk": 100}, power_score=100
    )
    
    print(f"Adding item: {sword.name} (Slot: {sword.slot})")
    
    # Add Item (Should auto-equip if better)
    InventoryService.add_item(p, sword)
    
    print(f"Inventory Count: {len(p.inventory)}")
    item = p.equipment.get(ItemSlotEnum.HAND_MAIN)
    print(f"Equipped Hand Main: {item.id if item else 'None'}")
    
    if item:
        print("SUCCESS: Auto-equipped.")
        
        # Test Stats Check
        p.calculate_stats()
        print(f"Player ATK (Level 0): {p.stats.atk}")
        
        # Simulate Upgrade to +15
        print("Simulating Upgrade to +15...")
        item.enhancement_level = 15
        p.calculate_stats()
        print(f"Player ATK (Level 15): {p.stats.atk}")
        
        # Verification
        # Base Player (10 STR + 10 AGI) -> 5 + 20 + 10 = 35 Base ATK.
        # Sword +100 ATK.
        # Lv 0: 35 + 100 = 135.
        # Lv 15: 35 + (100 * 1.05^15) = 35 + (100 * 2.078) = 35 + 207 = 242.
        
        expected_min = 200
        if p.stats.atk > expected_min:
             print(f"SUCCESS: Stats increased significantly ({p.stats.atk}).")
        else:
             print(f"FAILURE: Stats did not increase correctly ({p.stats.atk}).")

    else:
        print("FAILURE: Did not auto-equip.")

if __name__ == "__main__":
    test_equip()
