# 3D Isometric Migration Plan (Three.js)

## Objective
Transition the client-side rendering from HTML5 Canvas (2D) to Three.js (3D Isometric) without modifying the backend or core game logic.

## 1. Dependencies
- Import Three.js from a CDN (ES Modules) in `GameMap.js`.
- No npm install required for the current setup.

## 2. Coordinate System Mapping
- **Backend (2D):** X (Horizontal), Y (Vertical)
- **Three.js (3D):** 
  - `x` -> `x` (Left/Right)
  - `y` -> `z` (Forward/Backward)
  - `y` (Up/Down) will be 0 for the ground level.
- **Scale:** Keep `GAME_SCALE` but adapt it for 3D units.

## 3. `GameMap.js` Refactoring

### A. Initialization (`setup`)
- **Remove:** `canvas.getContext('2d')`
- **Add:**
  - `THREE.Scene`: The container for all 3D objects.
  - `THREE.OrthographicCamera`: Essential for the "Isometric" look (no perspective distortion).
  - `THREE.WebGLRenderer`: Renders the scene to the canvas.
  - `THREE.DirectionalLight` + `AmbientLight`: To make objects visible and cast shadows.

### B. Scene Objects
- **Ground:** A large `THREE.PlaneGeometry` representing the map (100x100 units).
- **Entities (Players/Monsters):**
  - Instead of drawing circles every frame, we maintain a `Map<id, THREE.Mesh>`.
  - **Create:** When a new entity appears in `mapMonsters` or `mapPlayers`.
  - **Update:** In the render loop, interpolate `mesh.position.x` and `mesh.position.z` to match the state.
  - **Remove:** When an entity is removed from the state, remove its mesh from the scene.
- **UI Elements (HP Bars, Names):**
  - Use `CSS2DRenderer` (an overlay on top of WebGL) OR standard HTML overlays positioned using `vector.project(camera)`.
  - *Simplification:* For now, we can project the 3D position to 2D screen coordinates and keep drawing text/bars using a transparent 2D canvas on top, OR use simple HTML absolute positioning.

### C. Input Handling (Raycasting)
- **Old:** Simple math `(screenX - center) / zoom`.
- **New:** `THREE.Raycaster`.
  - On click, cast a ray from camera -> mouse coordinates.
  - Find intersection with the **Ground Plane**.
  - The intersection point `(x, z)` is the target Game Coordinate.

### D. Camera Logic
- Camera follows the player.
- `camera.position.set(player.x + offset, height, player.y + offset)`
- `camera.lookAt(player.x, 0, player.y)`

## 4. Step-by-Step Execution

1.  **Backup:** Ensure `GameMap.js` is backed up (git commit).
2.  **Scaffold:** Replace the template to include a container for the 3D canvas.
3.  **Init Three.js:** Set up the basic boilerplate (Scene, Camera, Renderer).
4.  **Ground:** Add the floor plane with a grid texture or color.
5.  **Sync Loop:** Create the `updateScene()` function to sync Vue state (`player`, `monsters`) to Three.js meshes.
6.  **Interaction:** Implement Raycaster for movement/attack.
7.  **Polish:** Add simple animations (bobbing/rotating) to make it feel alive.

## 5. Risk Mitigation
- **Performance:** Three.js is heavier than Canvas 2D. We must ensure we dispose of geometries/materials when monsters die to avoid memory leaks.
- **Visuals:** It might look "empty" without assets. We will use distinct colors and simple shapes (Box for Player, Cylinder for Monsters) initially.
