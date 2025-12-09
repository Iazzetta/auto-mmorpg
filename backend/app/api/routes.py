from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List
import uuid
import random
import json
import os

from ..models.player import Player, PlayerClass, PlayerStats, Position, PlayerState
from ..models.item import Item, ItemType, ItemSlot, ItemRarity, ItemStats
from ..models.map import GameMap
from ..engine.state_manager import StateManager
from ..services.inventory_service import InventoryService

router = APIRouter()
state_manager = StateManager.get_instance()

# Load Items
ITEMS_DATA = {}
try:
    with open("backend/app/data/items.json", "r") as f:
        ITEMS_DATA = json.load(f)
except Exception as e:
    print(f"Error loading items in routes: {e}")

import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@router.post("/register", response_model=Player)
async def register(name: str, password: str, p_class: PlayerClass):
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
        password_hash=hash_password(password),
        p_class=p_class,
        stats=stats,
        current_map_id="map_castle_1", # Default start
        position=Position(x=50, y=50),
        is_admin=(name.lower() == "admin")
    )
    
    state_manager.add_player(player)
    
    # Force immediate persistence
    from ..services.persistence_service import PersistenceService
    await PersistenceService.get_instance().save_players()
    
    return player

@router.post("/login")
async def login(name: str, password: str):
    hashed = hash_password(password)
    for p in state_manager.players.values():
        if p.name == name:
            if p.password_hash == hashed:
                return p
            elif not p.password_hash: # Migration for existing users
                p.password_hash = hashed
                return p
            else:
                raise HTTPException(status_code=401, detail="Invalid password")
    
    raise HTTPException(status_code=404, detail="Player not found")

@router.get("/map/{map_id}/players")
async def get_map_players(map_id: str):
    # Return list of players in the map (basic info only)
    players = []
    for p in state_manager.players.values():
        if p.current_map_id == map_id and p.is_online:
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
    
    from ..data.items import ITEMS
    import json
    
    try:
        with open("backend/app/data/rewards.json", "r") as f:
            rewards_config = json.load(f)
    except FileNotFoundError:
        rewards_config = {"starter_chest": []}

    chest_items = rewards_config.get("starter_chest", [])
    
    for entry in chest_items:
        template_id = entry["item_id"]
        qty = entry["quantity"]
        
        template = ITEMS.get(template_id)
        if template:
            # Create new item instance
            new_stats = template["stats"].model_copy()
            
            new_item = Item(
                id=f"{template_id}_{uuid.uuid4().hex[:8]}",
                name=template["name"],
                type=template["type"],
                slot=template["slot"],
                rarity=template["rarity"],
                stats=new_stats,
                power_score=template["power_score"],
                icon=template["icon"],
                stackable=template["stackable"],
                quantity=qty
            )
            
            InventoryService.add_item(player, new_item)
            
    return {"message": "Chest opened", "inventory": player.inventory, "equipment": player.equipment}

# ... (existing code)

@router.get("/editor/rewards")
async def get_editor_rewards():
    import json
    try:
        with open("backend/app/data/rewards.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"starter_chest": []}

@router.post("/editor/rewards")
async def save_editor_rewards(data: dict):
    import json
    with open("backend/app/data/rewards.json", "w") as f:
        json.dump(data, f, indent=4)
    return {"message": "Rewards saved"}

@router.get("/map/{map_id}/npcs")
async def get_map_npcs(map_id: str):
    return [npc for npc in state_manager.npcs.values() if npc.map_id == map_id]

@router.post("/player/{player_id}/interact/{npc_id}")
async def interact_npc(player_id: str, npc_id: str):
    player = state_manager.get_player(player_id)
    npc = state_manager.npcs.get(npc_id)
    
    if not player or not npc:
        raise HTTPException(status_code=404, detail="Player or NPC not found")
        
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot interact while dead")
        
    # Validate distance (e.g., 5 units)
    import math
    dist = math.sqrt((player.position.x - npc.x)**2 + (player.position.y - npc.y)**2)
    if dist > 10: # Generous range
        raise HTTPException(status_code=400, detail="Too far away")
        
    return npc

@router.post("/player/{player_id}/npc/{npc_id}/action")
async def npc_action(player_id: str, npc_id: str, action: str, data: dict = {}):
    player = state_manager.get_player(player_id)
    npc = state_manager.npcs.get(npc_id)
    
    if not player or not npc:
        raise HTTPException(status_code=404, detail="Not found")
        
    if action == "accept_quest":
        quest_id = npc.quest_id
        if not quest_id:
            raise HTTPException(status_code=400, detail="NPC has no quest")
            
        # Check if already active or completed
        if player.active_mission_id == quest_id:
             return {"message": "Quest already active"}
        if quest_id in player.completed_missions:
             return {"message": "Quest already completed"}
             
        # Assign Quest
        player.active_mission_id = quest_id
        player.mission_progress = 0
        return {"message": "Quest accepted", "quest_id": quest_id}
        
    return {"message": "Unknown action"}

@router.post("/player/{player_id}/shop/buy")
async def buy_item(player_id: str, npc_id: str, item_id: str):
    player = state_manager.get_player(player_id)
    npc = state_manager.npcs.get(npc_id)
    
    if not player or not npc:
        raise HTTPException(status_code=404, detail="Not found")
        
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot buy items while dead")
        
    if npc.type != "merchant":
        raise HTTPException(status_code=400, detail="Not a merchant")
        
    if item_id not in npc.shop_items:
        raise HTTPException(status_code=400, detail="Item not sold here")
        
    # Get Item Template
    from ..data.items import ITEMS
    template = ITEMS.get(item_id)
    if not template:
        raise HTTPException(status_code=404, detail="Item template not found")
        
    # Check Price (Assume price is 10x power score or defined somewhere? For now, let's say 100 gold flat or based on rarity)
    # Ideally price should be in ITEMS or NPC data. Let's use a simple formula for now or check if item has price.
    # Let's assume price = power_score * 10 or 50 if 0.
    price = max(10, template.get("power_score", 0) * 10)
    
    stats = template.get("stats")
    if stats and stats.hp > 0: # Potion
        price = 50
        
    if player.gold < price:
        raise HTTPException(status_code=400, detail="Not enough gold")
        
    # Deduct Gold
    player.gold -= price
    
    # Add Item
    stats_data = template["stats"]
    if hasattr(stats_data, "model_copy"):
        stats_val = stats_data.model_copy()
    else:
        stats_val = ItemStats(**stats_data)

    new_item = Item(
        id=f"{item_id}_{uuid.uuid4().hex[:8]}",
        name=template["name"],
        type=template["type"],
        slot=template["slot"],
        rarity=template["rarity"],
        stats=stats_val,
        power_score=template.get("power_score", 0),
        icon=template.get("icon", "📦"),
        stackable=template.get("stackable", False),
        quantity=1
    )
    InventoryService.add_item(player, new_item)
    
    return {"message": "Item purchased", "gold": player.gold, "inventory": player.inventory}

@router.post("/player/{player_id}/use_item")
async def use_item(player_id: str, item_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot use items while dead")
        
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
        
    # Apply Effects
    effects = []
    
    if item_to_use.stats.hp > 0:
        healed = item_to_use.stats.hp
        player.stats.hp = min(player.stats.hp + healed, player.stats.max_hp)
        effects.append(f"Healed {healed} HP")
        
    if item_to_use.stats.xp > 0:
        res = player.gain_xp(item_to_use.stats.xp)
        effects.append(f"Gained {item_to_use.stats.xp} XP")
        if res['leveled_up']:
            effects.append(f"Leveled Up to {res['new_level']}!")
            
    if item_to_use.stats.gold > 0:
        player.gold += item_to_use.stats.gold
        effects.append(f"Gained {item_to_use.stats.gold} Gold")
        
    if item_to_use.stats.diamonds > 0:
        player.diamonds += item_to_use.stats.diamonds
        effects.append(f"Gained {item_to_use.stats.diamonds} Diamonds")
        
    # Consume Item
    if item_to_use.stackable and item_to_use.quantity > 1:
        item_to_use.quantity -= 1
    else:
        player.inventory.remove(item_to_use)
            
    return {"message": "Item used", "effects": effects, "player_stats": player.stats}

@router.post("/player/{player_id}/move")
async def move_player(player_id: str, target_map_id: str, x: float, y: float):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot move while dead")
    
    # Clamp coordinates
    x = max(0, min(100, x))
    y = max(0, min(100, y))

    # Explicit Map Switch (Portal)
    if target_map_id != player.current_map_id:
        # Check requirements
        target_map = state_manager.get_map(target_map_id)
        if target_map:
            if player.level < target_map.level_requirement:
                raise HTTPException(status_code=400, detail=f"Level {target_map.level_requirement} required to enter {target_map.name}")
            
            # Update Respawn if Castle
            if target_map.type == "castle":
                player.respawn_map_id = target_map_id
        
        old_map_id = player.current_map_id
        
        player.current_map_id = target_map_id
        player.position.x = x
        player.position.y = y
        player.state = PlayerState.IDLE
        player.target_position = None
        player.target_monster_id = None # Clear combat target
        
        # Broadcast Leave event to old map so clients remove the ghost mesh
        if hasattr(state_manager, 'connection_manager'):
             import asyncio
             # Fire and forget
             asyncio.create_task(state_manager.connection_manager.broadcast({
                 "type": "player_left_map",
                 "player_id": player.id,
                 "map_id": old_map_id
             }))
        
        return {"message": "Map switched", "map_id": target_map_id, "position": player.position}

    # Normal Movement
    player.target_position = Position(x=x, y=y)
    player.state = PlayerState.MOVING
    
    return {"message": "Moving", "target": player.target_position}

@router.post("/player/{player_id}/stop")
async def stop_movement(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    player.state = PlayerState.IDLE
    player.target_position = None
    
    # Broadcast stop details
    if hasattr(state_manager, 'connection_manager'):
        import asyncio
        asyncio.create_task(state_manager.connection_manager.broadcast({
            "type": "batch_update",
            "entities": [{
                "id": player.id,
                "type": "player",
                "x": player.position.x,
                "y": player.position.y,
                "state": player.state,
                "map_id": player.current_map_id
            }]
        }))
        
    return {"message": "Stopped", "position": player.position}

@router.post("/player/{player_id}/attack")
async def attack_monster(player_id: str, monster_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot attack while dead")
    
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
    
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot sell items while dead")
    
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
    xp_gained = mission["reward_xp"]
    gold_gained = mission["reward_gold"]
    
    player.gold += gold_gained
    result = player.gain_xp(xp_gained)
    
    # Archive
    player.completed_missions.append(player.active_mission_id)
    player.active_mission_id = None
    player.mission_progress = 0
    
    return {
        "message": "Mission claimed", 
        "rewards": {"xp": xp_gained, "gold": gold_gained},
        "level_up": result["leveled_up"],
        "new_level": result["new_level"]
    }

@router.post("/player/{player_id}/equip")
async def equip_item_endpoint(player_id: str, item_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot equip items while dead")
    
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

@router.post("/player/{player_id}/unequip")
async def unequip_item_endpoint(player_id: str, slot: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if player.stats.hp <= 0:
        raise HTTPException(status_code=400, detail="Cannot unequip items while dead")
        
    if slot not in player.equipment or not player.equipment[slot]:
        raise HTTPException(status_code=400, detail="Nothing equipped in this slot")

    InventoryService.unequip_item(player, slot)
    
    return {"message": "Item unequipped", "equipment": player.equipment, "inventory": player.inventory}

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

@router.get("/map/{map_id}")
async def get_map_details(map_id: str):
    m = state_manager.get_map(map_id)
    if not m:
        raise HTTPException(404, "Map not found")
        
    # Inject Active Cooldowns
    import time
    active_cooldowns = {}
    now = time.time()
    
    if m.resources:
        for res in m.resources:
            expiry = state_manager.resource_cooldowns.get(res.id)
            if expiry and expiry > now:
                active_cooldowns[res.id] = expiry - now
    
    # convert to dict
    if hasattr(m, "model_dump"):
        result = m.model_dump()
    else:
        result = m.dict()
        
    result["active_cooldowns"] = active_cooldowns
    return result

@router.post("/player/{player_id}/revive")
async def revive_player(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.stats.hp > 0:
        return {"message": "Player is already alive"}
        
    # Cost: 1 Diamond
    cost = 1
    if player.diamonds < cost:
        raise HTTPException(status_code=400, detail="Not enough diamonds to revive")
        
    player.diamonds -= cost
    player.stats.hp = player.stats.max_hp
    player.state = PlayerState.IDLE
    player.death_time = None
    
    return {"message": "Revived!", "hp": player.stats.hp, "diamonds": player.diamonds}

@router.post("/player/{player_id}/respawn")
async def respawn_player(player_id: str):
    player = state_manager.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.stats.hp > 0:
        return {"message": "Player is already alive"}
        
    # Check Timer
    import time
    if player.death_time:
        elapsed = time.time() - player.death_time
        if elapsed < 10:
            raise HTTPException(status_code=400, detail=f"Respawn available in {int(10 - elapsed)}s")
        
    # Respawn at save point
    player.stats.hp = player.stats.max_hp
    player.state = PlayerState.IDLE
    player.death_time = None
    
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
@router.get("/editor/items")
async def get_editor_items():
    from ..data.items import ITEMS
    return ITEMS

@router.post("/editor/items")
async def save_editor_items(items: dict):
    import json
    from ..data.items import load_items
    
    with open("backend/app/data/items.json", "w") as f:
        json.dump(items, f, indent=4)
    
    load_items()
    
@router.post("/player/{player_id}/gather")
async def gather_resource(player_id: str, resource_id: str):
    player = state_manager.players.get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    game_map = state_manager.maps.get(player.current_map_id)
    if not game_map:
        raise HTTPException(status_code=404, detail="Map not found")
        
    # Find resource
    resource = next((r for r in game_map.resources if r.id == resource_id), None)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    # Check Cooldown
    if not state_manager.is_resource_ready(resource_id):
        raise HTTPException(status_code=400, detail="Resource is regenerating")

    # Check Distance
    dist = ((player.position.x - resource.x) ** 2 + (player.position.y - resource.y) ** 2) ** 0.5
    if dist > 3.0:
        raise HTTPException(status_code=400, detail="Too far away")
        
    # Process Drops
    loot = []
    import random
    for drop in resource.drops:
        if random.random() <= drop.chance:
            qty = random.randint(drop.min_qty, drop.max_qty)
            if qty > 0:
                loot.append({"item_id": drop.item_id, "qty": qty})
    
    # Grant Loot
    inv_service = InventoryService()
    for item_drop in loot:
        item_id = item_drop['item_id']
        qty = item_drop['qty']
        
        item_def = ITEMS_DATA.get(item_id)
        if not item_def:
            print(f"Warning: Item {item_id} not found in database.")
            continue
            
        # Create Item Instance
        try:
            new_item = Item(
                id=str(uuid.uuid4()),
                name=item_def['name'],
                type=item_def['type'],
                slot=item_def.get('slot', 'none'),
                rarity=item_def.get('rarity', 'common'),
                stats=item_def.get('stats', {}),
                power_score=item_def.get('power_score', 0),
                icon=item_def.get('icon', '📦'),
                stackable=item_def.get('stackable', False),
                quantity=qty
            )
            inv_service.add_item(player, new_item)
        except Exception as e:
            print(f"Error creating item {item_id}: {e}")
            
    # Set Cooldown
    state_manager.set_resource_cooldown(resource_id, resource.respawn_time)
    
    # Broadcast Resource Update
    if hasattr(state_manager, 'connection_manager'):
        await state_manager.connection_manager.broadcast({
            "type": "resource_update", 
            "resource_id": resource_id, 
            "status": "cooldown", 
            "respawn_time": resource.respawn_time
        })

    return {"message": "Gathered successfully", "loot": loot, "cooldown": resource.respawn_time, "inventory": player.inventory}

@router.get("/editor/world")
async def get_editor_world():
    return state_manager.world_data

@router.post("/editor/world")
async def save_world(data: dict):
    import json
    with open("backend/app/data/world.json", "w") as f:
        json.dump(data, f, indent=4)
    
    state_manager.load_world_data()
    
    if hasattr(state_manager, 'connection_manager'):
        await state_manager.connection_manager.broadcast({"type": "server_update"})
    
    return {"message": "World saved"}

@router.get("/editor/npcs")
async def get_editor_npcs():
    import json
    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base_dir, "data/npcs.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

@router.post("/editor/npcs")
async def save_editor_npcs(npcs: dict):
    import json
    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base_dir, "data/npcs.json")
    with open(path, "w") as f:
        json.dump(npcs, f, indent=4)
    
    state_manager.load_npcs()
    
    if hasattr(state_manager, 'connection_manager'):
        await state_manager.connection_manager.broadcast({"type": "server_update"})
    
    return {"message": "NPCs saved"}

@router.get("/editor/textures/floors")
async def get_floor_textures():
    import os
    # Path relative to backend execution root (usually repo root)
    path = "client/public/maps/floor"
    try:
        if not os.path.exists(path):
            return []
        
        # List .png and .jpg files
        # Return as "floor/filename" so it works with /maps/ mount
        files = [f"floor/{f}" for f in os.listdir(path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        return files
    except Exception as e:
        print(f"Error listing textures: {e}")
        return []
