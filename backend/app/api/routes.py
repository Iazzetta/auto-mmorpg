from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List
import uuid
import random

from ..models.player import Player, PlayerClass, PlayerStats, Position, PlayerState
from ..models.item import Item, ItemType, ItemSlot, ItemRarity, ItemStats
from ..models.map import GameMap
from ..engine.state_manager import StateManager
from ..services.inventory_service import InventoryService

router = APIRouter()
state_manager = StateManager.get_instance()

@router.post("/player", response_model=Player)
async def create_player(name: str, p_class: PlayerClass):
    # Check if name exists
    for p in state_manager.players.values():
        if p.name == name:
            raise HTTPException(status_code=409, detail="Name already taken")

    # Initial stats based on class
    if p_class == PlayerClass.WARRIOR:
        stats = PlayerStats(hp=100, max_hp=100, atk=10, def_=5, speed=20.0)
    elif p_class == PlayerClass.MAGE:
        stats = PlayerStats(hp=60, max_hp=60, atk=15, def_=2, speed=20.0)
    else: # Archer
        stats = PlayerStats(hp=80, max_hp=80, atk=12, def_=3, speed=25.0)

    player = Player(
        id=str(uuid.uuid4()),
        token=str(uuid.uuid4()),
        name=name,
        p_class=p_class,
        stats=stats,
        current_map_id="map_castle_1", # Default start
        position=Position(x=0, y=0),
        is_admin=(name.lower() == "admin")
    )
    
    state_manager.add_player(player)
    return player

@router.get("/map/{map_id}/players")
async def get_map_players(map_id: str):
    # Return list of players in the map (basic info only)
    players = []
    for p in state_manager.players.values():
        if p.current_map_id == map_id:
            # Return subset of info to avoid leaking tokens/state
            players.append({
                "id": p.id,
                "name": p.name,
                "level": p.level,
                "p_class": p.p_class,
                "position": p.position,
                "hp": p.stats.hp,
                "max_hp": p.stats.max_hp,
                "state": p.state
            })
    return players

@router.get("/player/{player_id}", response_model=Player)
async def get_player(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player

@router.post("/player/{player_id}/open_chest")
async def open_starter_chest(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Generate Starter Set
    # 1. Weapon
    weapon = Item(
        id=str(uuid.uuid4()),
        name="Starter Sword",
        type=ItemType.WEAPON,
        slot=ItemSlot.HAND_MAIN,
        rarity=ItemRarity.COMMON,
        stats=ItemStats(atk=3)
    )
    weapon.calculate_power_score()
    InventoryService.add_item(player, weapon)
    
    # 2. Armor
    armor = Item(
        id=str(uuid.uuid4()),
        name="Starter Tunic",
        type=ItemType.ARMOR,
        slot=ItemSlot.CHEST,
        rarity=ItemRarity.COMMON,
        stats=ItemStats(def_=2)
    )
    armor.calculate_power_score()
    InventoryService.add_item(player, armor)
    
    # Add Potions
    potion = Item(
        id=f"potion_hp_{uuid.uuid4().hex[:8]}",
        name="Health Potion",
        type=ItemType.CONSUMABLE,
        slot=ItemSlot.NONE,
        rarity=ItemRarity.COMMON,
        stats=ItemStats(hp=50), # Heals 50 HP
        power_score=10,
        quantity=10,
        stackable=True
    )
    InventoryService.add_item(player, potion)
    
    return {"message": "Chest opened", "inventory": player.inventory, "equipment": player.equipment}

@router.post("/player/{player_id}/use_item")
async def use_item(player_id: str, item_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    # Find item
    item_to_use = None
    for item in player.inventory:
        if item.id == item_id:
            item_to_use = item
            break
            
    if not item_to_use:
        raise HTTPException(status_code=404, detail="Item not found")
        
    if item_to_use.type != ItemType.CONSUMABLE:
        raise HTTPException(status_code=400, detail="Item is not consumable")
        
    # Effect (Hardcoded for HP potion for now)
    if "Potion" in item_to_use.name:
        healed = 50
        player.stats.hp = min(player.stats.hp + healed, player.stats.max_hp)
        
        if item_to_use.stackable and item_to_use.quantity > 1:
            item_to_use.quantity -= 1
        else:
            player.inventory.remove(item_to_use)
            
        return {"message": "Potion used", "hp_healed": healed, "current_hp": player.stats.hp}
        
    return {"message": "Item used (no effect)"}

@router.post("/player/{player_id}/move")
async def move_player(player_id: str, target_map_id: str, x: float, y: float):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Clamp coordinates
    x = max(0, min(100, x))
    y = max(0, min(100, y))

    # Explicit Map Switch (Portal)
    if target_map_id != player.current_map_id:
        # Check requirements
        target_map = state_manager.get_map(target_map_id)
        if target_map:
            if player.level < target_map.level_requirement:
                return {"message": f"Level {target_map.level_requirement} required to enter {target_map.name}", "position": player.position}
            
            # Update Respawn if Castle
            if target_map.type == "castle":
                player.respawn_map_id = target_map_id
        
        player.current_map_id = target_map_id
        player.position.x = x
        player.position.y = y
        player.state = PlayerState.IDLE
        player.target_position = None
        player.target_monster_id = None # Clear combat target
        
        return {"message": "Map switched", "map_id": target_map_id, "position": player.position}

    # Normal Movement
    player.target_position = Position(x=x, y=y)
    player.state = PlayerState.MOVING
    
    return {"message": "Moving", "target": player.target_position}

@router.post("/player/{player_id}/attack")
async def attack_monster(player_id: str, monster_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    monster = state_manager.monsters.get(monster_id)
    if not monster:
        raise HTTPException(status_code=404, detail="Monster not found")
        
    if str(player.current_map_id) != str(monster.map_id):
        raise HTTPException(status_code=400, detail="Monster is in a different map")
        
    player.state = PlayerState.COMBAT
    player.target_monster_id = monster_id
    
    return {"message": "Combat started"}

@router.post("/player/{player_id}/sell_item")
async def sell_item(player_id: str, item_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Find item in inventory
    item_to_sell = None
    for item in player.inventory:
        if item.id == item_id:
            item_to_sell = item
            break
            
    if not item_to_sell:
        raise HTTPException(status_code=404, detail="Item not found in inventory")
        
    # Remove item or decrement quantity
    if item_to_sell.stackable and item_to_sell.quantity > 1:
        item_to_sell.quantity -= 1
    else:
        player.inventory.remove(item_to_sell)
    # Simple price calculation
    price = item_to_sell.power_score * 2 + 5
    player.gold += price
    
    player.gold += price
    
    return {"message": "Item sold", "gold_gained": price, "current_gold": player.gold}

@router.post("/player/{player_id}/allocate_attributes")
async def allocate_attributes(player_id: str, attributes: dict):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    cost = sum(attributes.values())
    if cost > player.attribute_points:
        raise HTTPException(status_code=400, detail="Not enough attribute points")
        
    for attr, amount in attributes.items():
        if attr in player.attributes:
            player.attributes[attr] += amount
            
    player.attribute_points -= cost
    player.calculate_stats()
    
    return {"message": "Attributes allocated", "player": player}

@router.post("/admin/missions")
async def save_missions(missions: dict):
    # Save to file
    import json
    with open("backend/app/data/missions.json", "w") as f:
        json.dump(missions, f, indent=4)
    
    # Reload in state manager
    state_manager.load_missions()
    
    return {"message": "Missions saved"}

import json
import os

def load_missions():
    try:
        with open("backend/app/data/missions.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

@router.post("/player/{player_id}/mission/start")
async def start_mission(player_id: str, mission_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    missions = load_missions()
    mission = missions.get(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
        
    if player.level < mission["level_requirement"]:
        raise HTTPException(status_code=400, detail="Level too low")
        
    if player.active_mission_id != mission_id:
        player.active_mission_id = mission_id
        player.mission_progress = 0
    
    return {"message": "Mission started", "mission": mission}

@router.post("/player/{player_id}/mission/claim")
async def claim_mission(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if not player.active_mission_id:
        raise HTTPException(status_code=400, detail="No active mission")
        
    missions = load_missions()
    mission = missions.get(player.active_mission_id)
    
    if player.mission_progress < mission["target_count"]:
        raise HTTPException(status_code=400, detail="Mission not completed")
        
    # Grant Rewards
    player.xp += mission["reward_xp"]
    player.gold += mission["reward_gold"]
    
    # Archive
    player.completed_missions.append(player.active_mission_id)
    player.active_mission_id = None
    player.mission_progress = 0
    
    return {
        "message": "Mission claimed", 
        "rewards": {"xp": mission["reward_xp"], "gold": mission["reward_gold"]}
    }

@router.post("/player/{player_id}/equip")
async def equip_item_endpoint(player_id: str, item_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Find item in inventory
    item_to_equip = None
    for item in player.inventory:
        if item.id == item_id:
            item_to_equip = item
            break
            
    if not item_to_equip:
        raise HTTPException(status_code=404, detail="Item not found in inventory")
        
    # Equip logic
    # We need to remove it from inventory first as InventoryService.equip_item expects it to be separate or handles it?
    # InventoryService.equip_item takes (player, item). It puts old item in inventory.
    # It does NOT remove the new item from inventory if it's already there.
    # So we must remove it from inventory list first.
    player.inventory.remove(item_to_equip)
    InventoryService.equip_item(player, item_to_equip)
    
    return {"message": "Item equipped", "equipment": player.equipment}

@router.get("/map/{map_id}/monsters")
async def get_map_monsters(map_id: str):
    # Get monster IDs in map
    monster_ids = state_manager.map_monsters.get(map_id, [])
    monsters = []
    for mid in monster_ids:
        m = state_manager.monsters.get(mid)
        if m:
            monsters.append(m)
    return monsters

@router.get("/content/missions")
async def get_missions():
    return load_missions()

@router.get("/map/{map_id}", response_model=GameMap)
async def get_map_details(map_id: str):
    m = state_manager.get_map(map_id)
    if not m:
        raise HTTPException(404, "Map not found")
    return m

@router.post("/player/{player_id}/revive")
async def revive_player(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.stats.hp > 0:
        return {"message": "Player is already alive"}
        
    # Cost: 100 Gold (Placeholder for Diamonds)
    cost = 100
    if player.gold < cost:
        raise HTTPException(status_code=400, detail="Not enough gold to revive")
        
    player.gold -= cost
    player.stats.hp = player.stats.max_hp
    player.state = PlayerState.IDLE
    
    return {"message": "Revived!", "hp": player.stats.hp, "gold": player.gold}

@router.post("/player/{player_id}/respawn")
async def respawn_player(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.stats.hp > 0:
        return {"message": "Player is already alive"}
        
    # Respawn at save point
    player.stats.hp = player.stats.max_hp
    player.state = PlayerState.IDLE
    
    respawn_map = state_manager.get_map(player.respawn_map_id)
    if respawn_map:
        player.current_map_id = respawn_map.id
        player.position.x = respawn_map.respawn_x
        player.position.y = respawn_map.respawn_y
    else:
        player.current_map_id = "map_castle_1"
        player.position.x = 50
        player.position.y = 50
        
    return {"message": "Respawned", "map_id": player.current_map_id, "position": player.position}
