from ..models.monster import MonsterType, MonsterStats

MONSTERS = {
    "mob_wolf_01": {
        "name": "Dire Wolf",
        "level": 1,
        "m_type": MonsterType.MELEE,
        "stats": MonsterStats(hp=50, max_hp=50, atk=8, def_=2, speed=1.5),
        "xp_reward": 20,
        "respawn_time": 20.0,
        "drops": [
            {"item_id": "item_sword_01", "chance": 0.1},
            {"item_id": "item_potion_hp_01", "chance": 0.2}
        ]
    },
    "mob_goblin_01": {
        "name": "Goblin Scout",
        "level": 2,
        "m_type": MonsterType.MELEE,
        "stats": MonsterStats(hp=80, max_hp=80, atk=12, def_=3, speed=1.2),
        "xp_reward": 35,
        "respawn_time": 25.0,
        "drops": [
            {"item_id": "item_sword_01", "chance": 0.15},
            {"item_id": "item_armor_01", "chance": 0.1}
        ]
    },
    "mob_bear_01": {
        "name": "Brown Bear",
        "level": 5,
        "m_type": MonsterType.MELEE,
        "stats": MonsterStats(hp=200, max_hp=200, atk=25, def_=8, speed=0.8),
        "xp_reward": 100,
        "respawn_time": 45.0,
        "drops": [
            {"item_id": "item_sword_02", "chance": 0.2},
            {"item_id": "item_sword_03", "chance": 0.1},
            {"item_id": "item_potion_hp_01", "chance": 0.5}
        ]
    }
}

SPAWNS = {
    "map_forest_1": [
        {"template_id": "mob_wolf_01", "x": 10, "y": 10},
        {"template_id": "mob_wolf_01", "x": 15, "y": 15},
        {"template_id": "mob_wolf_01", "x": 5, "y": 20},
        {"template_id": "mob_goblin_01", "x": 80, "y": 20},
        {"template_id": "mob_goblin_01", "x": 90, "y": 30},
        {"template_id": "mob_goblin_01", "x": 75, "y": 40},
        {"template_id": "mob_bear_01", "x": 40, "y": 80}
    ],
    "map_castle_1": [] 
}
