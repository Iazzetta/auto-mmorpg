import json
import os

class StateLoader:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.world = {}
        self.items = {}
        self.missions = {}
        self.npcs = {}
        self.monsters = {} # In monsters.py or json? Current monsters.py is python code.
        self.monster_templates = {} 
        self.resource_templates = {}
        self.rewards = [] # Fix init for rewards

    def load_all(self):
        self.load_world()
        self.load_items()
        self.load_missions()
        self.load_rewards()
        self.load_npcs()
        return {
            "world": self.world,
            "items": self.items,
            "missions": self.missions,
            "rewards": self.rewards,
            "npcs": self.npcs
        }

    def load_world(self):
        try:
            with open(os.path.join(self.data_dir, "world.json"), "r") as f:
                self.world = json.load(f)
                self.monster_templates = self.world.get("monster_templates", {})
                self.resource_templates = self.world.get("resource_templates", {})
        except FileNotFoundError:
            print("Warning: world.json not found")

    def load_items(self):
        try:
            with open(os.path.join(self.data_dir, "items.json"), "r") as f:
                self.items = json.load(f)
        except FileNotFoundError:
             print("Warning: items.json not found")

    def load_missions(self):
        try:
            with open(os.path.join(self.data_dir, "missions.json"), "r") as f:
                self.missions = json.load(f)
        except FileNotFoundError:
             print("Warning: missions.json not found")
             
    def load_rewards(self):
        try:
            with open(os.path.join(self.data_dir, "rewards.json"), "r") as f:
                self.rewards = json.load(f)
        except FileNotFoundError:
             print("Warning: rewards.json not found")
             
    def load_npcs(self):
        try:
            with open(os.path.join(self.data_dir, "npcs.json"), "r") as f:
                self.npcs = json.load(f)
        except FileNotFoundError:
             print("Warning: npcs.json not found")

    def get_max_levels(self):
        # Determine current frontier
        max_map_level = 0
        for m in self.world.get("maps", {}).values():
            if m.get("level_requirement", 0) > max_map_level:
                max_map_level = m.get("level_requirement", 0)
        
        max_monster_level = 0
        for m in self.monster_templates.values():
             if m.get("level", 0) > max_monster_level:
                 max_monster_level = m.get("level", 0)
                 
        return max_map_level, max_monster_level
