# System Architecture

## Tech Stack
*   **Backend**: Python 3.11+
    *   **Framework**: FastAPI (Async Web Framework)
    *   **Server**: Uvicorn (ASGI Server)
    *   **State Management**: In-memory singleton (`StateManager`)
*   **Frontend**: HTML5 / JavaScript (ES6 Modules)
    *   **Framework**: Vue.js 3 (Composition API)
    *   **Styling**: TailwindCSS
    *   **Visualization**: Three.js (WebGL) for 3D Isometric Rendering
        *   **Models**: FBX Format (Characters, Animations)
        *   **Animations**: `THREE.AnimationMixer`
*   **Communication**:
    *   **REST API**: For transactional actions (Login, Register, Move, Gather, Equip).
    *   **WebSockets**: For real-time updates (Chat, Combat, Entity Positions, Resource Spawns).

## Backend Structure (`backend/`)
*   **`main.py`**: Entry point. Sets up FastAPI app, CORS, Static Files (maps), and starts the `GameLoop`. Defines WebSocket endpoint.
*   **`app/`**:
    *   **`api/`**:
        *   **`routes.py`**: HTTP endpoints for Player actions.
        *   **`editor.py`**: Endpoints for World Editor.
    *   **`engine/`**:
        *   **`game_loop.py`**: Async loop (`tick`) processing combat, regeneration, and spawns.
        *   **`state_manager.py`**: Singleton global state (Players, Maps, Monsters).
    *   **`services/`**:
        *   **`combat_service.py`**: Damage formulas, loot tables, death logic.
        *   **`inventory_service.py`**: Item management.
    *   **`models/`**: Pydantic models.
    *   **`data/`**: JSON files for world persistence (`world.json`, `missions.json`).

## Frontend Structure (`client/src/`)
*   **`App.js`**: Main Vue Component.
    *   Manages overarching UI (Editor, Modals).
    *   Handles Login/Register.
    *   Initializes Global Keybindings.
*   **`components/`**:
    *   **`GameMap.js`**: Core 3D Logic.
        *   **Three.js Setup**: Scene, Camera, Lights, Raycaster.
        *   **Render Loop**: `animate()` handles Minimap, Entity Positions, and Animations.
        *   **Entity Management**: `updateEntityLifecycle` (Mesh creation/removal).
    *   **`Navbar.js`**, **`Hotbar.js`**: UI HUD components.
    *   **`InventoryModal.js`**, **`AttributesModal.js`**: Game Logic Modals.
    *   **`WorldEditor.js`**: Admin tools for map editing.
*   **`services/`**:
    *   **`api.js`**: HTTP fetch wrappers and WebSocket event handling (`onmessage`).
    *   **`state.js`**: Global Reactive State (Vue `ref`s) shared across components.
    *   **`autoFarm.js`**: Logic for automated farming bot.

## Data Flow Example (Combat)
1.  **Client Action**: User clicks "Auto Attack" (switches `isFreeFarming` to true).
2.  **Client Loop**: `checkAndAct()` (in `autoFarm.js`) finds nearest monster.
3.  **API Call**: `POST /player/{id}/move` to get in range.
4.  **API Call**: `POST /player/{id}/attack` when in range.
5.  **Backend**: `CombatService` calculates damage.
6.  **Broadcast**: `GameLoop` sends `combat_update` via WebSocket.
7.  **Client Update**:
    *   `api.js` receives message.
    *   `GameAlerts.js` shows floating damage number.
    *   `GameMap.js` updates monster HP bar (via reactive state).
