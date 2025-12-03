# System Architecture

## Tech Stack
*   **Backend**: Python 3.11+
    *   **Framework**: FastAPI (Async Web Framework)
    *   **Server**: Uvicorn (ASGI Server)
    *   **State Management**: In-memory singleton (`StateManager`)
*   **Frontend**: HTML5 / JavaScript
    *   **Framework**: Vue.js 3 (via CDN, Composition API)
    *   **Styling**: TailwindCSS (via CDN)
    *   **Visualization**: HTML5 Canvas (for Map)
*   **Communication**:
    *   **REST API**: For transactional actions (Move, Equip, Sell, Attribute Allocation).
    *   **WebSockets**: For high-frequency state updates (Combat logs, HP changes, Position updates).

## Backend Structure (`backend/app/`)
*   **`main.py`**: Entry point. Sets up FastAPI app, CORS, and starts the `GameLoop`.
*   **`api/routes.py`**: Defines HTTP endpoints and WebSocket connection handler.
*   **`engine/`**:
    *   **`game_loop.py`**: The heartbeat of the server. Runs an async loop (`tick`) that processes combat, respawns, and state updates.
    *   **`state_manager.py`**: Singleton that holds the global state (Players, Monsters, Maps).
*   **`services/`**:
    *   **`combat_service.py`**: Pure logic for damage calculation, loot generation, and death handling.
    *   **`inventory_service.py`**: Logic for adding/removing items and managing stacks.
*   **`models/`**: Pydantic models defining data structures (`Player`, `Monster`, `Item`, `Map`).
*   **`data/`**: Static data definitions (`items.py`, `monsters.py`, `missions.py`).

## Frontend Structure (`client/`)
*   **`index.html`**: Single Page Application (SPA) containing:
    *   HTML Layout (Header, Stats, Map, Log, Inventory).
    *   Vue.js Application Logic (`createApp`).
    *   Canvas Rendering Logic (`drawMap`).
    *   WebSocket handling and event dispatching.

## Data Flow
1.  **Client Action**: User clicks "Attack".
2.  **API Call**: Client sends `POST /player/{id}/attack`.
3.  **State Update**: Backend updates Player state to `COMBAT` and sets target.
4.  **Game Loop**:
    *   Detects player in `COMBAT` state.
    *   Calls `CombatService.process_combat_round()`.
    *   Updates HP, checks for death/loot.
5.  **Broadcast**: `GameLoop` pushes a `combat_update` event via WebSocket.
6.  **Client Render**: Vue app receives event, updates HP bar, and appends log message.
