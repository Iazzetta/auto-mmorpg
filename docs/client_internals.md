# Client Internals: GameMap & Rendering Setup

## Overview
The core of the 3D experience is handled by `client/src/components/GameMap.js`. This component integrates Vue.js reactivity with the Three.js rendering library.

## Rendering Loop (`animate` function)
The render loop operates at the browser's refresh rate (via `requestAnimationFrame`).

### Core Responsibilities
1.  **Minimap**: Calls `drawMinimap()` to render 2D representation on canvas.
2.  **Entity Positions**: Calls `updateEntityPositions()` to handle interpolation and movement logic.
3.  **Entity Lifecycle**: Watchers trigger `updateEntityLifecycle()` to add/remove Three.js meshes based on game state.
4.  **Monster UI**: Updates the current target's HP card visibility.
5.  **Rendering**: Calls `renderer.render(scene, camera)`.
6.  **FPS Calculation**: Updates frames per second counter.

## Entity Management

### 1. `updateEntityLifecycle( )`
*   **Trigger**: Called when `mapPlayers`, `mapMonsters`, or `currentMapData` changes (via Vue Watchers).
*   **Goal**: Ensure the Three.js Scene graph matches the reactive State.
*   **Logic**:
    1.  Creates a `Set` of valid IDs from current state.
    2.  Iterates through Players, Monsters, Portals, Resources.
    3.  **Create**: If an ID exists in State but not in `meshes` Map, it loads the model (FBX or Geometry) and adds to Scene.
    4.  **Update**: Updates `mesh.userData.entity` with latest data.
    5.  **Cleanup**: Iterates `meshes` Map; if ID is not in Valid Set, removes from Scene and disposes memory.

### 2. `updateEntityPositions( )`
*   **Trigger**: Called every frame in `animate()`.
*   **Goal**: Smooth movement and animations.
*   **Logic**:
    *   Iterates all meshes.
    *   **Interpolation**: Smoothly moves mesh from current position to target position (`entity.x`, `entity.y`) using `LERP_FACTOR`.
    *   **Rotation**: Calculates angle to target and rotates mesh (`rotation.y`).
    *   **Animations**:
        *   Checks `isMoving` (distance to target > threshold).
        *   Checks `state` (COMBAT, IDLE).
        *   Transitions Animation Mixer (`idle` -> `run` -> `attack`) with cross-fading.
    *   **Camera Follow**: Smoothly moves camera to follow local player.

## Asset Loading (FBX)
*   **Loader**: `THREE.FBXLoader`
*   **Process**:
    1.  Loads `idle.fbx` as base mesh.
    2.  Creates `THREE.AnimationMixer`.
    3.  Asynchronously loads `run.fbx`, `attack.fbx` and adds clips to mixer.
    4.  Stores mixer and actions in `mesh.userData`.

## State Integration
The component relies on `client/src/state.js` for data:
*   `player`: Local player data.
*   `mapPlayers`: List of other players in map.
*   `mapMonsters`: List of monsters.
## Auto-Farming & Pathfinding
*   **Pathfinder (`src/services/Pathfinder.js`)**:
    *   **Initialization**: Fetches world graph from API (`/editor/world`).
    *   **Algorithm**: Breadth-First Search (BFS) to find shortest path of Maps/Portals.
    *   **Reconstruction**: Returns step-by-step navigation list (Portals) to target.
*   **Auto-Farm Cycle**:
    1.  **Check Map**: Am I on the target map?
    2.  **Navigation**: If not, query `Pathfinder`, find next portal, move to it (`api.movePlayer`), and wait for transition.
    3.  **Mission Execution**:
        *   **Kill**: `findAndAttackTarget()` (filters by Mission Target ID).
        *   **Deliver/Talk**: `findAndInteractWithNPC()`.
        *   **Gather**: `findAndGatherResource()`.
    4.  **Loop**: Runs every 1s (`checkAndAct`).
