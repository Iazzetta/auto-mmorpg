import json
import os
import asyncio
from typing import Dict
from ..models.player import Player
from ..engine.state_manager import StateManager

DATA_DIR = "data"
PLAYERS_FILE = os.path.join(DATA_DIR, "players.json")

class PersistenceService:
    _instance = None

    @staticmethod
    def get_instance():
        if PersistenceService._instance is None:
            PersistenceService._instance = PersistenceService()
        return PersistenceService._instance

    def __init__(self):
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR)
        self.state_manager = StateManager.get_instance()
        self.saving = False

    def load_players(self):
        if not os.path.exists(PLAYERS_FILE):
            return

        try:
            with open(PLAYERS_FILE, "r") as f:
                data = json.load(f)
                for player_data in data.values():
                    try:
                        player = Player(**player_data)
                        # Reset runtime state
                        player.state = "idle" 
                        player.target_monster_id = None
                        self.state_manager.add_player(player)
                    except Exception as e:
                        print(f"Error loading player: {e}")
            print(f"Loaded {len(self.state_manager.players)} players from disk.")
        except Exception as e:
            print(f"Error reading players file: {e}")

    async def save_players_loop(self):
        while True:
            await asyncio.sleep(10) # Save every 10 seconds
            await self.save_players()

    async def save_players(self):
        if self.saving: return
        self.saving = True
        try:
            # Create a snapshot of data to write
            players_data = {
                pid: player.dict() 
                for pid, player in self.state_manager.players.items()
            }
            
            # Write to temp file then rename for atomic write
            temp_file = PLAYERS_FILE + ".tmp"
            
            # Run blocking I/O in executor
            await asyncio.to_thread(self._write_file, temp_file, players_data)
            
            os.replace(temp_file, PLAYERS_FILE)
            # print("Saved players to disk.")
        except Exception as e:
            print(f"Error saving players: {e}")
        finally:
            self.saving = False

    def _write_file(self, filename, data):
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)
