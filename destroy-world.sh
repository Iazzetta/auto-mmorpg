echo "--- Resetting World Data in C:\Users\guilh\work\auto-mmorpg\backend\app\data ---"
# Check if python or python3
if command -v python3 >/dev/null 2>&1; then
    PY_CMD=python3
else
    PY_CMD=python
fi

$PY_CMD tools/ai_game_master/reset_world.py

# Also delete persistence data to avoid "ghost" players in deleted maps
if [ -f "data/players.json" ]; then
    echo "Removing persistent player data (data/players.json)..."
    rm "data/players.json"
fi

echo "--- World Destruction Complete. Clean Slate. ---"
