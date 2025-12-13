import argparse
import os
import math
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from state_loader import StateLoader
from gemini_client import GeminiClient
from content_merger import ContentMerger

# --- CONFIGURATION ---
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/app/data"))

def calculate_balanced_stats(level):
    """
    Returns balanced stats for a monster of a given level.
    Goal: Level 100 takes approx 48h active play.
    Formula: Exponential scaling.
    """
    # Base values at level 1
    base_hp = 50
    base_xp = 20
    
    # Scaling factor (adjust to tune difficulty)
    # HP doubles every ~10 levels?
    hp_scale = 1.15 
    xp_scale = 1.12
    
    hp = int(base_hp * (hp_scale ** (level - 1)))
    xp = int(base_xp * (xp_scale ** (level - 1)))
    
    # ATK/DEF scaling
    atk = int(level * 5 + 5)
    def_ = int(level * 2 + 2)
    
    return {
        "hp": hp,
        "max_hp": hp,
        "atk": atk,
        "def_": def_,
        "speed": 5, # Standard speed
        "xp_reward": xp
    }

def balance_content(generated_data, start_lvl, end_lvl):
    """
    Overwrites LLM generated numbers with mathematically balanced ones.
    """
    print("Balancing content stats...")
    
    monsters = generated_data.get("monster_templates", {})
    if not monsters:
        return

    # Sort monsters by some logic or just assign levels spread evenly
    monster_ids = list(monsters.keys())
    levels_step = (end_lvl - start_lvl) / max(1, len(monster_ids))
    
    current_assigned_lvl = start_lvl
    
    for m_id, m_data in monsters.items():
        # Assign Level
        level = int(current_assigned_lvl)
        m_data["level"] = level
        current_assigned_lvl += levels_step
        
        # Calculate Stats
        stats = calculate_balanced_stats(level)
        
        # Merge stats (keep names/drops if present, override numbers)
        if "stats" not in m_data: m_data["stats"] = {}
        
        m_data["stats"]["hp"] = stats["hp"]
        m_data["stats"]["max_hp"] = stats["max_hp"]
        m_data["stats"]["atk"] = stats["atk"]
        m_data["stats"]["def_"] = stats["def_"]
        m_data["xp_reward"] = stats["xp_reward"]
        
        print(f"  - Balanced {m_data.get('name')} (Lv {level}): {stats['hp']} HP, {stats['xp_reward']} XP")

def main():
    parser = argparse.ArgumentParser(description="AI Game Master - Content Generator")
    parser.add_argument("--levels", type=int, default=100, help="Number of levels to generate content for")
    parser.add_argument("--theme", type=str, default="", help="Optional theme influence")
    parser.add_argument("--api_key", type=str, help="Legacy API Key (use credentials for Vertex AI)")
    parser.add_argument("--credentials", type=str, help="Path to Service Account JSON")
    
    args = parser.parse_args()
    
    # Priority: Flag > Env > Default File
    creds_path = args.credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path:
        # Check for user specified default
        possible_path = "aim-master-db93e-0e177e63a9bc.json"
        if os.path.exists(possible_path):
            creds_path = os.path.abspath(possible_path)

    print(f"--- AI Game Master Initializing ---")
    if creds_path:
        print(f"Auth: Service Account ({os.path.basename(creds_path)})")
    else:
        print("Auth: Warning - No credentials found, relying on default auth or API Key")

    print(f"Target: Generate content for next {args.levels} levels.")
    
    # 1. Load State
    loader = StateLoader(DATA_DIR)
    state = loader.load_all()
    
    last_map_lvl, last_mob_lvl = loader.get_max_levels()
    start_lvl = max(last_map_lvl, last_mob_lvl) + 1
    end_lvl = start_lvl + args.levels
    
    print(f"Current Frontier: Level {start_lvl-1}")
    print(f"Expansion Range: Level {start_lvl} to {end_lvl}")
    
    # 2. Generate Content
    try:
        client = GeminiClient(credentials_path=creds_path)
    except Exception as e:
        print(f"Failed to init Gemini Logic: {e}")
        return

    print("Requesting content from Gemini (this may take a moment)...")
    generated_data = client.generate_content_updates(state, (start_lvl, end_lvl), theme=args.theme)
    
    if not generated_data:
        print("Failed to generate content.")
        return

    # 3. Balance Content
    balance_content(generated_data, start_lvl, end_lvl)
    
    # 4. Preview
    print("\n--- Generation Summary ---")
    print(f"New Maps: {len(generated_data.get('maps', {}))}")
    print(f"New Monsters: {len(generated_data.get('monster_templates', {}))}")
    print(f"New Items: {len(generated_data.get('items', {}))}")
    print(f"New Missions: {len(generated_data.get('missions', {}))}")
    
    confirm = input("\nProceed with merge? (y/n): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return

    # 5. Merge
    merger = ContentMerger(DATA_DIR)
    merger.merge_and_save(generated_data, loader)
    print("Done! Restart server to see changes.")

if __name__ == "__main__":
    main()
