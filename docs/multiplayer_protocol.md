# Multiplayer Protocol (WebSocket)

## Overview
The real-time synchronization is handled via WebSockets connected to `/ws/{client_id}`.
Files involved:
*   **Detailed Handling**: `backend/main.py` (Server), `client/src/services/api.js` (Client).

## Message Format
All messages are JSON objects.
*   **Common Fields**:
    *   `type`: String identifier for the event (e.g., `chat`, `combat_update`).

## Client -> Server Events

### 1. Chat
Sends a global chat message.
```json
{
    "type": "chat",
    "message": "Hello World"
}
```

*Note: Movement and Combat actions are currently sent via REST API (`POST /player/...`), not WebSocket. The WebSocket is primarily used for receiving updates.*

## Server -> Client Events

### 1. `chat`
Broadcasts a chat message to all connected clients.
```json
{
    "type": "chat",
    "player_id": "uuid",
    "name": "PlayerName",
    "message": "Hello World"
}
```

### 2. `batch_update`
Sent every game tick (approx. 100ms) containing state of all entities in the map.
```json
{
    "type": "batch_update",
    "entities": [
        {
            "id": "uuid",
            "type": "player",
            "x": 10.5,
            "y": 20.2,
            "state": "IDLE", // COMBAT, MOVING
            "map_id": "map_forest_1",
            "target_id": "target_uuid"
        },
        {
            "id": "monster_id",
            "type": "monster",
            "x": 15.0,
            "y": 20.0,
            "state": "ATTACKING"
        }
    ]
}
```

### 3. `combat_update`
Sent when damage occurs.
```json
{
    "type": "combat_update",
    "damage": 15,
    "crit": false,
    "source_id": "player_id",
    "target_id": "monster_id",
    "hp": 85,
    "max_hp": 100
}
```

### 4. `monster_respawn`
Sent when a monster respawns.
```json
{
    "type": "monster_respawn",
    "monster": { ...monster_data... }
}
```

### 5. `player_left`
Sent when a player disconnects.
```json
{
    "type": "player_left",
    "player_id": "uuid"
}
```
