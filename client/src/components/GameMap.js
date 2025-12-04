import { ref, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { player, mapMonsters, mapPlayers, destinationMarker, currentMonster, addLog, selectedTargetId, isFreeFarming, pendingAttackId, inspectedPlayer, selectedMapId } from '../state.js';
import { api } from '../services/api.js';
import { stopAutoFarm, checkAndAct } from '../services/autoFarm.js';

export default {
    template: `
        <div class="absolute top-14 bottom-0 w-full bg-gray-950 overflow-hidden">
            <!-- Map Info -->
            <div class="absolute top-4 left-4 text-xs text-gray-500 font-mono z-10 bg-black/50 px-2 py-1 rounded pointer-events-none">
                MAP: {{ formatMapName(player?.current_map_id) }} | {{ Math.round(player?.position?.x || 0) }}, {{ Math.round(player?.position?.y || 0) }}
            </div>

            <!-- 3D Container -->
            <div ref="container" class="w-full h-full cursor-crosshair block"></div>

            <!-- Enemy Status Overlay -->
            <div v-if="currentMonster"
                class="absolute top-16 right-4 bg-gray-800 p-2 rounded border border-red-900 shadow-xl z-20 w-48 pointer-events-none">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-red-400 text-xs truncate">{{ currentMonster.name }}</span>
                    <span class="text-xs text-gray-400">{{ currentMonster.hp }}/{{ currentMonster.max_hp }}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div class="bg-red-600 h-full transition-all duration-300"
                        :style="{ width: (currentMonster.hp / currentMonster.max_hp * 100) + '%' }"></div>
                </div>
            </div>

            <!-- Interaction Button -->
            <div v-if="canEnterPortal && !isFreeFarming" class="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-50">
                <button @click="confirmPortal" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-full shadow-lg border-2 border-blue-400 animate-bounce">
                    Enter Portal (F)
                </button>
            </div>
            
            <!-- FPS Counter -->
            <div class="absolute top-0 right-0 bg-black/50 text-green-400 font-mono text-xs px-2 py-1 pointer-events-none">
                FPS: {{ fps }}
            </div>
        </div>
    `,
    setup() {
        const container = ref(null);
        const fps = ref(0);
        const canEnterPortal = ref(false);
        const pendingPortal = ref(null);
        const currentMapData = ref(null);

        // Three.js variables
        let scene, camera, renderer, raycaster, mouse;
        let groundPlane;
        let animationId;

        // Entity Meshes Map: ID -> Mesh
        const meshes = new Map();
        // Label Sprites Map: ID -> Sprite/HTML
        // For simplicity, we'll draw labels using 2D canvas overlay or just rely on the UI for selected target.
        // Let's stick to 3D only for now, maybe add floating text later.

        const keys = { w: false, a: false, s: false, d: false };
        let lastMoveTime = 0;

        const formatMapName = (id) => {
            if (!id) return '';
            return id.replace('map_', '').replace('_', ' ').toUpperCase();
        };

        const initThree = () => {
            const width = container.value.clientWidth;
            const height = container.value.clientHeight;

            // 1. Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x111827); // Dark gray background

            // 2. Camera (Orthographic for Isometric)
            const aspect = width / height;
            const d = 20; // View size
            camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);

            // Isometric Angle: Look from corner
            camera.position.set(20, 20, 20);
            camera.lookAt(scene.position); // Will be updated to follow player

            // 3. Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(width, height);
            renderer.shadowMap.enabled = true;
            container.value.appendChild(renderer.domElement);

            // Force initial resize to ensure correct dimensions
            onWindowResize();

            // 4. Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(50, 50, 0);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            dirLight.shadow.camera.left = -50;
            dirLight.shadow.camera.right = 50;
            dirLight.shadow.camera.top = 50;
            dirLight.shadow.camera.bottom = -50;
            scene.add(dirLight);

            // 5. Ground
            const geometry = new THREE.PlaneGeometry(100, 100);
            const material = new THREE.MeshStandardMaterial({
                color: 0x1f2937,
                side: THREE.DoubleSide
            });
            groundPlane = new THREE.Mesh(geometry, material);
            groundPlane.rotation.x = -Math.PI / 2; // Lay flat
            groundPlane.position.set(50, 0, 50); // Center at 50,50 (Game coords 0-100)
            groundPlane.receiveShadow = true;
            scene.add(groundPlane);

            // Grid Helper
            const gridHelper = new THREE.GridHelper(100, 10, 0x374151, 0x374151);
            gridHelper.position.set(50, 0.01, 50); // Slightly above ground
            scene.add(gridHelper);

            // 6. Raycaster
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            // Event Listeners
            window.addEventListener('resize', onWindowResize);
            container.value.addEventListener('click', onMouseClick);
        };

        const onWindowResize = () => {
            if (!container.value) return;
            const width = container.value.clientWidth;
            const height = container.value.clientHeight;
            const aspect = width / height;
            const d = 20;

            camera.left = -d * aspect;
            camera.right = d * aspect;
            camera.top = d;
            camera.bottom = -d;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };

        const onMouseClick = async (event) => {
            if (!player.value) return;

            // Calculate mouse position in normalized device coordinates
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            // Check intersections
            const intersects = raycaster.intersectObjects(scene.children);

            for (let i = 0; i < intersects.length; i++) {
                const obj = intersects[i].object;

                // Check if clicked a Monster
                if (obj.userData.type === 'monster') {
                    const m = obj.userData.entity;
                    if (m.hp > 0) {
                        addLog(`Moving to attack ${m.name}...`);
                        stopAutoFarm();

                        // Set current monster for UI
                        currentMonster.value = m;
                        selectedTargetId.value = m.template_id;
                        selectedMapId.value = player.value.current_map_id;

                        // Don't enable auto-farm on manual click, just attack this specific target
                        isFreeFarming.value = false;

                        // Move towards monster (0 distance)
                        const angle = Math.atan2(m.position_y - player.value.position.y, m.position_x - player.value.position.x);
                        const stopDist = 0;
                        const targetX = m.position_x - Math.cos(angle) * stopDist;
                        const targetY = m.position_y - Math.sin(angle) * stopDist;

                        await api.movePlayer(player.value.current_map_id, targetX, targetY);
                        destinationMarker.value = { x: targetX, y: targetY, isGameCoords: true };
                        setTimeout(() => destinationMarker.value = null, 500);
                        pendingAttackId.value = m.id;
                        return;
                    }
                }

                // Check if clicked Ground
                if (obj === groundPlane) {
                    const point = intersects[i].point;
                    const gameX = point.x;
                    const gameY = point.z; // Z is Y in 2D

                    stopAutoFarm();
                    destinationMarker.value = { x: gameX, y: gameY, time: Date.now(), isGameCoords: true };
                    api.movePlayer(player.value.current_map_id, gameX, gameY);

                    setTimeout(() => destinationMarker.value = null, 500);
                    return;
                }
            }
        };

        const updateEntities = () => {
            const validIds = new Set();

            // 1. Local Player
            if (player.value) {
                const pid = player.value.id;
                validIds.add(pid);
                let mesh = meshes.get(pid);
                if (!mesh) {
                    // Create Player Mesh (Green Cube)
                    const geo = new THREE.BoxGeometry(1, 2, 1);
                    const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.castShadow = true;
                    mesh.userData = { type: 'player', entity: player.value };
                    scene.add(mesh);
                    meshes.set(pid, mesh);
                }
                // Update Position (Lerp for smoothness could be added here)
                mesh.position.set(player.value.position.x, 1, player.value.position.y);

                // Camera Follow
                camera.position.set(
                    player.value.position.x + 20,
                    20,
                    player.value.position.y + 20
                );
                camera.lookAt(player.value.position.x, 0, player.value.position.y);
            }

            // 2. Other Players
            mapPlayers.value.forEach(p => {
                if (p.id === player.value.id) return;
                validIds.add(p.id);
                let mesh = meshes.get(p.id);
                if (!mesh) {
                    const geo = new THREE.BoxGeometry(1, 2, 1);
                    const mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.castShadow = true;
                    mesh.userData = { type: 'player', entity: p };
                    scene.add(mesh);
                    meshes.set(p.id, mesh);
                }
                mesh.position.set(p.position.x, 1, p.position.y);
            });

            // 3. Monsters
            mapMonsters.value.forEach(m => {
                if (!m.stats || m.stats.hp <= 0) return;
                validIds.add(m.id);
                let mesh = meshes.get(m.id);
                if (!mesh) {
                    // Create Monster Mesh (Red Cylinder)
                    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16);
                    const mat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.castShadow = true;
                    mesh.userData = { type: 'monster', entity: m };
                    scene.add(mesh);
                    meshes.set(m.id, mesh);
                }
                mesh.position.set(m.position_x, 0.75, m.position_y);

                // Update user data for raycasting
                mesh.userData.entity = m;

                // Color flash on hit? (Optional polish)
            });

            // 4. Portals
            if (currentMapData.value && currentMapData.value.portals) {
                currentMapData.value.portals.forEach(portal => {
                    const pid = `portal_${portal.id} `;
                    validIds.add(pid);
                    let mesh = meshes.get(pid);
                    if (!mesh) {
                        const geo = new THREE.TorusGeometry(1, 0.2, 8, 16);
                        const mat = new THREE.MeshStandardMaterial({ color: portal.color || 0xffffff, emissive: portal.color || 0x000000, emissiveIntensity: 0.5 });
                        mesh = new THREE.Mesh(geo, mat);
                        mesh.rotation.x = -Math.PI / 2; // Flat on ground? Or upright? Let's do upright.
                        mesh.rotation.x = 0;
                        mesh.position.set(portal.x, 1, portal.y);
                        scene.add(mesh);
                        meshes.set(pid, mesh);
                    }
                    // Rotate portal effect
                    mesh.rotation.y += 0.02;
                });
            }

            // 5. Cleanup
            for (const [id, mesh] of meshes) {
                if (!validIds.has(id)) {
                    scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                    meshes.delete(id);
                }
            }
        };

        const updateMovement = () => {
            if (!player.value) return;
            const now = Date.now();
            if (now - lastMoveTime < 100) return; // Throttle 100ms

            let dx = 0;
            let dy = 0;
            if (keys.w) dy -= 1;
            if (keys.s) dy += 1;
            if (keys.a) dx -= 1;
            if (keys.d) dx += 1;

            if (dx !== 0 || dy !== 0) {
                stopAutoFarm();
                isFreeFarming.value = false;

                // Normalize vector
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;

                const dist = 5;
                const targetX = player.value.position.x + dx * dist;
                const targetY = player.value.position.y + dy * dist;

                api.movePlayer(player.value.current_map_id, targetX, targetY);
                lastMoveTime = now;
            }
        };

        const checkPortals = () => {
            if (!player.value || !currentMapData.value) return;
            const p = player.value.position;
            let closestDist = 999;
            let closestPortal = null;

            if (currentMapData.value.portals) {
                for (const portal of currentMapData.value.portals) {
                    const dist = Math.sqrt((p.x - portal.x) ** 2 + (p.y - portal.y) ** 2);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPortal = portal;
                    }
                }
            }

            if (closestPortal && closestDist < 2.0) {
                pendingPortal.value = {
                    name: closestPortal.label || 'Portal',
                    targetMap: closestPortal.target_map_id,
                    x: closestPortal.target_x,
                    y: closestPortal.target_y
                };
                canEnterPortal.value = true;
                if (isFreeFarming.value) confirmPortal();
            } else {
                canEnterPortal.value = false;
                pendingPortal.value = null;
            }
        };

        const confirmPortal = async () => {
            if (pendingPortal.value) {
                await api.movePlayer(pendingPortal.value.targetMap, pendingPortal.value.x, pendingPortal.value.y);
                canEnterPortal.value = false;
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = true;
            if (e.key === 'a' || e.key === 'A') keys.a = true;
            if (e.key === 's' || e.key === 'S') keys.s = true;
            if (e.key === 'd' || e.key === 'D') keys.d = true;
            if (e.key === 'f' || e.key === 'F') {
                if (canEnterPortal.value) confirmPortal();
            }
            if (e.key === ' ') {
                if (isFreeFarming.value) {
                    stopAutoFarm();
                    addLog("Auto Attack Disabled", "text-red-400");
                } else {
                    isFreeFarming.value = true;
                    checkAndAct();
                    addLog("Auto Attack Enabled", "text-green-400");
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = false;
            if (e.key === 'a' || e.key === 'A') keys.a = false;
            if (e.key === 's' || e.key === 'S') keys.s = false;
            if (e.key === 'd' || e.key === 'D') keys.d = false;
        };

        let frameCount = 0;
        let lastFpsTime = performance.now();

        const animate = () => {
            animationId = requestAnimationFrame(animate);

            updateMovement();
            checkPortals();
            updateEntities();

            renderer.render(scene, camera);

            // FPS
            const now = performance.now();
            frameCount++;
            if (now - lastFpsTime >= 1000) {
                fps.value = frameCount;
                frameCount = 0;
                lastFpsTime = now;
            }
        };

        watch(() => player.value?.current_map_id, async (newMapId) => {
            if (newMapId) {
                stopAutoFarm();
                await api.fetchMapMonsters(newMapId);
                api.fetchMapPlayers(newMapId);
                try {
                    const res = await fetch(`http://localhost:8000/map/${newMapId}`);
                    if (res.ok) currentMapData.value = await res.json();
                } catch (e) { console.error(e); }
            }
        }, { immediate: true });

        onMounted(() => {
            // Wait for next tick/timeout to ensure container has dimensions
            setTimeout(() => {
                initThree();
                animate();
            }, 100);

            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            if (player.value?.current_map_id) {
                api.fetchMapMonsters(player.value.current_map_id);
                api.fetchMapPlayers(player.value.current_map_id);
            }
        });

        onUnmounted(() => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (renderer) {
                renderer.dispose();
                container.value.removeChild(renderer.domElement);
            }
        });

        return {
            container,
            player,
            currentMonster,
            formatMapName,
            canEnterPortal,
            confirmPortal,
            isFreeFarming,
            fps
        };
    }
};
