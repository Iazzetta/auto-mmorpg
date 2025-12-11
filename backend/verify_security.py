from fastapi.testclient import TestClient
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from backend.main import app
from backend.app.engine.state_manager import StateManager
from backend.app.models.player import Player, PlayerClass, PlayerStats, Position

client = TestClient(app)
state_manager = StateManager.get_instance()

# Create Admin
admin = Player(
    id="admin_id", token="t1", name="admin", password_hash="pqpfdp12345",
    p_class=PlayerClass.WARRIOR, stats=PlayerStats(hp=100, max_hp=100),
    current_map_id="map1", position=Position(x=0,y=0),
    is_admin=True
)
state_manager.add_player(admin)

# Create User
user = Player(
    id="user_id", token="t2", name="user", password_hash="hash",
    p_class=PlayerClass.WARRIOR, stats=PlayerStats(hp=100, max_hp=100),
    current_map_id="map1", position=Position(x=0,y=0),
    is_admin=False
)
state_manager.add_player(user)

def test_routes():
    print("Running Security Checks...")
    
    routes_to_test = [
        ("GET", "/editor/world"),
        ("POST", "/editor/items"),
        ("GET", "/editor/rewards"),
        ("GET", "/editor/npcs"),
        ("GET", "/editor/enhancement"),
    ]

    for method, path in routes_to_test:
        # 1. Admin
        if method == "GET":
            res = client.get(path, headers={"X-Player-ID": "admin_id"})
        else:
            res = client.post(path, json={}, headers={"X-Player-ID": "admin_id"})
        
        status = "PASS" if res.status_code in [200, 422] else f"FAIL ({res.status_code})" # 422 is fine for empty json in post, means it got past auth
        print(f"[{status}] Admin {method} {path}")

        # 2. User
        if method == "GET":
            res = client.get(path, headers={"X-Player-ID": "user_id"})
        else:
            res = client.post(path, json={}, headers={"X-Player-ID": "user_id"})
            
        status = "PASS" if res.status_code == 403 else f"FAIL ({res.status_code})"
        print(f"[{status}] User  {method} {path}")

        # 3. No Auth
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
            
        status = "PASS" if res.status_code == 401 else f"FAIL ({res.status_code})"
        print(f"[{status}] NoAuth {method} {path}")
        
    # Test specific routes in routes.py
    print("\nChecking /admin/missions in routes.py:")
    res = client.post("/admin/missions", json={}, headers={"X-Player-ID": "admin_id"})
    print(f"[{'PASS' if res.status_code == 200 else f'FAIL ({res.status_code})'}] Admin POST /admin/missions")
    
    res = client.post("/admin/missions", json={}, headers={"X-Player-ID": "user_id"})
    print(f"[{'PASS' if res.status_code == 403 else f'FAIL ({res.status_code})'}] User POST /admin/missions")

if __name__ == "__main__":
    test_routes()
