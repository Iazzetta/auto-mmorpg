import asyncio
import aiohttp
import argparse
import random
import time
import uuid

# --- CONFIG ---
API_URL = "http://localhost:8000"
MOBS_TO_IGNORE = [] # Add IDs if needed

class Bot:
    def __init__(self, index, session, leader_name=None):
        self.index = index
        self.session = session
        self.leader_name = leader_name
        self.name = f"Bot_{index:02d}"
        self.password = "password123"
        self.id = None
        self.token = None 
        self.map_id = None
        self.x = 50
        self.y = 50
        self.hp = 100
        self.max_hp = 100
        self.level = 1
        self.state = "IDLE" 
        self.active_mission_id = None
        self.inventory = []
        self.attribute_points = 0
        
        # Behavior State
        self.current_action = "THINKING"
        self.target_entity_id = None
        self.last_action_time = 0

    async def log(self, msg):
        prefix = f"[{self.name}]"
        if self.leader_name:
            prefix += " [FOLLOWER]"
        print(f"{prefix} {msg}")

    async def register_or_login(self):
        # Try Login
        try:
            async with self.session.post(f"{API_URL}/login", params={"name": self.name, "password": self.password}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.id = data["id"]
                    self.update_state(data)
                    return True
        except:
            pass

        # Register
        try:
            p_class = random.choice(["warrior", "mage", "archer"])
            async with self.session.post(f"{API_URL}/register", params={"name": self.name, "password": self.password, "p_class": p_class}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.id = data["id"]
                    self.update_state(data)
                    await self.log(f"Registered new {p_class}")
                    return True
                else:
                    return False
        except Exception as e:
            return False

    def update_state(self, data):
        self.id = data["id"]
        self.map_id = data.get("current_map_id")
        pos = data.get("position", {})
        self.x = pos.get("x", 50)
        self.y = pos.get("y", 50)
        
        stats = data.get("stats", {})
        self.hp = stats.get("hp", 100)
        self.max_hp = stats.get("max_hp", 100)
        self.level = data.get("level", 1)
        self.active_mission_id = data.get("active_mission_id")
        self.inventory = data.get("inventory", [])
        self.attribute_points = data.get("attribute_points", 0)

    async def fetch_self(self):
        async with self.session.get(f"{API_URL}/player/{self.id}") as resp:
            if resp.status == 200:
                self.update_state(await resp.json())

    async def loop(self):
        while True:
            try:
                if not self.id:
                    if not await self.register_or_login():
                        await asyncio.sleep(5)
                        continue

                # Refresh State
                await self.fetch_self()
                
                if self.hp <= 0:
                    # Logic to respawn? For now just wait
                    await asyncio.sleep(5)
                    continue

                # AI LOGIC
                await self.decide_action()
                
                # Faster tick for followers to be responsive
                ts = random.uniform(0.5, 1.5) if self.leader_name else random.uniform(1.0, 3.0)
                await asyncio.sleep(ts) 

            except Exception as e:
                # await self.log(f"Error in loop: {e}")
                await asyncio.sleep(5)

    async def decide_action(self):
        # 1. Attribute Allocation (Auto-Level Up)
        if self.attribute_points > 0:
            await self.allocate_attributes()

        # 2. Follow Leader Logic
        if self.leader_name:
            await self.follow_leader()
            return

        # 3. Independent Logic (Mission Check)
        if not self.active_mission_id:
            await self.find_mission()
        else:
            await self.progress_mission()
            
    async def follow_leader(self):
        # Find Leader Position
        leader_info = await self.find_leader()
        if not leader_info:
            # await self.log("Leader not found...")
            return

        l_map = leader_info["map_id"]
        l_x = leader_info["x"]
        l_y = leader_info["y"]
        
        # Check Map
        if self.map_id != l_map:
            await self.log(f"Warping to leader's map: {l_map}")
            # Warp to leader's location
            await self.move_to_map_at(l_map, l_x, l_y)
            return
            
        # Check Position (Circle Formation)
        # Calculate target position around leader
        import math
        angle = (self.index * 30) * (math.pi / 180) # Spread bots in a circle
        radius = 4 # Distance from leader
        
        target_x = l_x + radius * math.cos(angle)
        target_y = l_y + radius * math.sin(angle)
        
        dist = ((target_x - self.x)**2 + (target_y - self.y)**2)**0.5
        
        if dist > 3:
            await self.move(target_x, target_y)
            
    async def find_leader(self):
        async with self.session.get(f"{API_URL}/find_player", params={"name": self.leader_name}) as resp:
            if resp.status == 200:
                return await resp.json()
        return None

    async def allocate_attributes(self):
        # Simple Logic: Split between STR (Active) and VIT (HP)
        alloc = {"str": 0, "vit": 0, "int": 0, "dex": 0}
        points = self.attribute_points
        
        # Just dump all in STR for now for damage
        alloc["str"] = points
        
        async with self.session.post(f"{API_URL}/player/{self.id}/allocate_attributes", json=alloc) as resp:
            if resp.status == 200:
                pass

    async def find_mission(self):
        if self.map_id != "map_castle_1":
            await self.move_to_map_at("map_castle_1", 50, 50)
            return

        # Look for NPCs in current map
        npcs = await self.get_map_npcs()
        for npc in npcs:
            if npc["type"] == "quest_giver" or npc["id"] in ["npc_commander_thorne", "npc_guide_01"]:
                # Try to interact
                await self.interact_and_accept(npc)
                return

    async def progress_mission(self):
        # 1. Look for monsters
        monsters = await self.get_map_monsters()
        if monsters:
            # Filter living
            target = random.choice(monsters)
            
            # Move to target
            dist = ((target["position_x"] - self.x)**2 + (target["position_y"] - self.y)**2)**0.5
            if dist > 3:
                await self.move(target["position_x"], target["position_y"])
            else:
                await self.attack(target["id"])
                
            # Random chance to claim mission (if completed)
            if random.random() < 0.1:
                await self.claim_mission()
        else:
            await self.move(random.randint(10, 90), random.randint(10, 90))
            
            if self.map_id == "map_castle_1":
                await self.move_to_map_at("map_training_grounds", 50, 50)

    # --- ACTIONS ---

    async def get_map_npcs(self):
        async with self.session.get(f"{API_URL}/map/{self.map_id}/npcs") as resp:
            if resp.status == 200:
                return await resp.json()
        return []

    async def get_map_monsters(self):
        async with self.session.get(f"{API_URL}/map/{self.map_id}/monsters") as resp:
            if resp.status == 200:
                return await resp.json()
        return []

    async def interact_and_accept(self, npc):
        # Move close
        dist = ((npc["x"] - self.x)**2 + (npc["y"] - self.y)**2)**0.5
        if dist > 3:
            await self.move(npc["x"], npc["y"])
            return

        # Interact
        async with self.session.post(f"{API_URL}/player/{self.id}/interact/{npc['id']}") as resp:
            if resp.status == 200:
                data = await resp.json()
                # Check for quest
                if "quest_id" in data and data["quest_id"]:
                    # Accept it
                    await self.accept_mission(data["quest_id"])

    async def accept_mission(self, mission_id):
        async with self.session.post(f"{API_URL}/player/{self.id}/mission/start", params={"mission_id": mission_id}) as resp:
            if resp.status == 200:
                await self.log(f"Accepted Mission: {mission_id}")
            else:
                pass

    async def claim_mission(self):
        async with self.session.post(f"{API_URL}/player/{self.id}/mission/claim") as resp:
            if resp.status == 200:
                data = await resp.json()
                if "message" in data and "claimed" in data["message"].lower():
                    await self.log(f"Mission COMPLETED!")

    async def move(self, x, y):
        async with self.session.post(f"{API_URL}/player/{self.id}/move", 
                                     params={"target_map_id": self.map_id, "x": x, "y": y}) as resp:
            if resp.status == 200:
                self.x = x
                self.y = y

    async def move_to_map_at(self, target_map_id, x, y):
        async with self.session.post(f"{API_URL}/player/{self.id}/move", 
                                     params={"target_map_id": target_map_id, "x": x, "y": y}) as resp:
            if resp.status == 200:
                self.map_id = target_map_id
                # await self.log(f"Traveled to {target_map_id}")

    async def attack(self, monster_id):
        async with self.session.post(f"{API_URL}/player/{self.id}/attack", params={"monster_id": monster_id}) as resp:
            pass

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10, help="Number of bots")
    parser.add_argument("--leader", type=str, help="Name of the player to follow")
    args = parser.parse_args()

    print(f"--- Launching Bot Swarm ({args.count} bots) ---")
    if args.leader:
        print(f"--- MODE: FOLLOWING LEADER [{args.leader}] ---")
    
    async with aiohttp.ClientSession() as session:
        bots = [Bot(i+1, session, args.leader) for i in range(args.count)]
        
        # Run all bots
        await asyncio.gather(*(bot.loop() for bot in bots))

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopping Swarm.")
