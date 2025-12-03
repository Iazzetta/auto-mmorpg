# API Reference

Base URL: `http://localhost:8000`

## Player Endpoints
*   `POST /player`: Create a new player.
*   `GET /player/{player_id}`: Get full player state.
*   `POST /player/{player_id}/move`: Move to coordinates or map.
    *   Params: `target_map_id`, `x`, `y`.
*   `POST /player/{player_id}/attack`: Engage a monster.
    *   Params: `monster_id`.
*   `POST /player/{player_id}/equip`: Equip an item.
    *   Params: `item_id`.
*   `POST /player/{player_id}/use_item`: Use a consumable.
    *   Params: `item_id`.
*   `POST /player/{player_id}/sell_item`: Sell an item for gold.
    *   Params: `item_id`.
*   `POST /player/{player_id}/allocate_attributes`: Spend attribute points.
    *   Body: JSON `{ "str": 1, "agi": 0, ... }` (diff values).

## Content Endpoints
*   `GET /map/{map_id}/monsters`: List all live monsters on a map.
*   `GET /content/missions`: List all available missions.

## WebSocket Events
URL: `ws://localhost:8000/ws/{player_id}`

### Server -> Client Messages
*   **`combat_update`**:
    *   `player_hp`, `monster_hp`
    *   `log`: `{ player_dmg, monster_dmg, monster_died, drops... }`
*   **`player_moved`**:
    *   `x`, `y`, `map_id`
*   **`monster_respawn`**:
    *   `monster`: Full monster object.
