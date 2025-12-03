import asyncio
import aiohttp
import websockets
import json

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/test_client"

async def test_flow():
    async with aiohttp.ClientSession() as session:
        # 1. Create Player
        print("Creating Player...")
        async with session.post(f"{BASE_URL}/player", params={"name": "Hero", "p_class": "warrior"}) as resp:
            player = await resp.json()
            print(f"Player Created: {player['id']} - {player['name']}")
            player_id = player['id']

        # 2. Open Chest
        print("\nOpening Chest...")
        async with session.post(f"{BASE_URL}/player/{player_id}/open_chest") as resp:
            data = await resp.json()
            print(f"Chest Opened. Inventory: {len(data['inventory'])} items")
            print(f"Equipment: {data['equipment']}")

        # 3. Connect WebSocket
        print("\nConnecting WebSocket...")
        async with websockets.connect(WS_URL) as websocket:
            
            # 4. Move Player (Trigger movement)
            print("\nMoving Player...")
            async with session.post(f"{BASE_URL}/player/{player_id}/move", 
                                  params={"target_map_id": "map_forest_1", "x": 10.0, "y": 10.0}) as resp:
                print(await resp.json())

            # 5. Attack Monster (Trigger combat)
            print("\nAttacking Monster...")
            # We know the monster ID is 'mob_wolf_01' from main.py
            async with session.post(f"{BASE_URL}/player/{player_id}/attack", 
                                  params={"monster_id": "mob_wolf_01"}) as resp:
                print(await resp.json())

            # 6. Listen for updates
            print("\nListening for updates (5 seconds)...")
            try:
                while True:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(msg)
                    print(f"Received: {data}")
                    if data.get("type") == "combat_update" and data.get("log", {}).get("monster_died"):
                        print("Monster Died! Test Successful.")
                        break
            except asyncio.TimeoutError:
                print("Timeout waiting for updates.")

if __name__ == "__main__":
    asyncio.run(test_flow())
