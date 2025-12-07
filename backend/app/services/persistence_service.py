import json
import os
import asyncio
from typing import Dict
from ..models.player import Player
from ..engine.state_manager import StateManager

# Use absolute path relative to CWD (root of project)
DATA_DIR = os.path.abspath("data")
PLAYERS_FILE = os.path.join(DATA_DIR, "players.json")

class PersistenceService:
    _instance = None

    @staticmethod
    def get_instance():
        if PersistenceService._instance is None:
            PersistenceService._instance = PersistenceService()
        return PersistenceService._instance

    def __init__(self):
        print(f"[Persistence] Initializing. Data Path: {DATA_DIR}")
        if not os.path.exists(DATA_DIR):
            try:
                os.makedirs(DATA_DIR)
                print(f"[Persistence] Created {DATA_DIR}")
            except Exception as e:
                print(f"[Persistence] Failed to create data dir: {e}")
        self.state_manager = StateManager.get_instance()
        self.saving = False

    def load_players(self):
        print(f"[Persistence] Loading players from {PLAYERS_FILE}")
        if not os.path.exists(PLAYERS_FILE):
            print("[Persistence] File does not exist.")
            return

        try:
            with open(PLAYERS_FILE, "r") as f:
                data = json.load(f)
                print(f"[Persistence] Found {len(data)} entries in file.")
                for player_data in data.values():
                    try:
                        player = Player(**player_data)
                        # Reset runtime state
                        from ..models.player import PlayerState
                        player.state = PlayerState.IDLE
                        player.target_monster_id = None
                        self.state_manager.add_player(player)
                    except Exception as e:
                        print(f"[Persistence] Error loading player datum: {e}")
                        # print(player_data) # Debug
            print(f"[Persistence] Loaded {len(self.state_manager.players)} players into memory.")
        except Exception as e:
            print(f"[Persistence] Error reading players file: {e}")

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
