from ..models.item import ItemType, ItemSlot, ItemRarity, ItemStats

ITEMS = {
    "item_sword_01": {
        "name": "Iron Sword",
        "type": ItemType.WEAPON,
        "slot": ItemSlot.HAND_MAIN,
        "rarity": ItemRarity.COMMON,
        "stats": ItemStats(atk=5),
        "power_score": 5,
        "icon": "⚔️"
    },
    "item_sword_02": {
        "name": "Steel Sword",
        "type": ItemType.WEAPON,
        "slot": ItemSlot.HAND_MAIN,
        "rarity": ItemRarity.UNCOMMON,
        "stats": ItemStats(atk=10, strength=2),
        "power_score": 12,
        "icon": "⚔️"
    },
    "item_sword_03": {
        "name": "High Sword",
        "type": ItemType.WEAPON,
        "slot": ItemSlot.HAND_MAIN,
        "rarity": ItemRarity.RARE,
        "stats": ItemStats(atk=15, strength=5),
        "power_score": 20,
        "icon": "⚔️"
    },
    "item_armor_01": {
        "name": "Leather Tunic",
        "type": ItemType.ARMOR,
        "slot": ItemSlot.CHEST,
        "rarity": ItemRarity.COMMON,
        "stats": ItemStats(def_=3),
        "power_score": 3,
        "icon": "🎽"
    },
    "item_potion_hp_01": {
        "name": "Health Potion",
        "type": ItemType.CONSUMABLE,
        "slot": ItemSlot.NONE,
        "rarity": ItemRarity.COMMON,
        "stats": ItemStats(hp=50),
        "power_score": 10,
        "icon": "🧪",
        "stackable": True
    }
}
