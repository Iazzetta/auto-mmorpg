import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { player, mapMonsters, mapPlayers, destinationMarker, currentMonster, addLog, selectedTargetId, isFreeFarming, pendingAttackId, inspectedPlayer, selectedMapId, currentMapData, mapNpcs, showGameAlert, socket, activeMission } from '../state.js';
import { api } from '../services/api.js';
import { stopAutoFarm, checkAndAct } from '../services/autoFarm.js';

export default {
    emits: ['interact-npc'],
    template: `
        <div class="absolute top-14 bottom-0 w-full bg-gray-950 overflow-hidden">
            <!-- Map Info -->
            <div class="absolute top-4 left-4 text-xs text-gray-500 font-mono z-10 bg-black/50 px-2 py-1 rounded pointer-events-none flex gap-2">
                <span>MAP: {{ formatMapName(player?.current_map_id) }} | {{ Math.round(player?.position?.x || 0) }}, {{ Math.round(player?.position?.y || 0) }}</span>
                <span class="text-green-400 font-bold border-l border-gray-600 pl-2">FPS: {{ fps }}</span>
            </div>

            <!-- 3D Container -->
            <div ref="container" class="w-full h-full cursor-crosshair block"></div>

            <!-- Entity Labels -->
            <div v-for="label in entityLabels" :key="label.id" 
                class="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full flex flex-col items-center z-30"
                :style="{ left: label.x + 'px', top: label.y + 'px' }">
                <span class="text-[10px] font-bold shadow-black drop-shadow-md whitespace-nowrap"
                    :class="label.type === 'portal' ? 'text-cyan-300 text-xs tracking-wider bg-black/50 px-1 rounded' : (label.type === 'npc' ? 'text-yellow-300 text-xs bg-black/50 px-1 rounded' : (label.isPlayer ? 'text-green-300' : 'text-red-300'))">
                    {{ label.name }}
                </span>
                <div v-if="label.max_hp > 0" class="w-8 h-1 bg-gray-700 mt-0.5 rounded-full overflow-hidden border border-black/50">
                    <div class="h-full transition-all duration-300"
                        :class="label.isPlayer ? 'bg-green-500' : 'bg-red-500'"
                        :style="{ width: (label.hp / label.max_hp * 100) + '%' }"></div>
                </div>
            </div>

            <!-- Minimap -->
            <div class="absolute top-4 right-4 w-[120px] h-[120px] bg-black/80 border border-gray-600 rounded z-30 overflow-hidden shadow-lg">
                <canvas ref="minimapCanvas" width="120" height="120" class="w-full h-full block opacity-90"></canvas>
            </div>

            <!-- Enemy Status Overlay -->
            <div v-if="currentMonster"
                class="absolute top-14 left-4 bg-gray-800 p-2 rounded border border-red-900 shadow-xl z-20 w-48 pointer-events-none">
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
            <div v-if="(canEnterPortal || canInteractNpc || canGather) && !isFreeFarming && !isGathering" class="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
                <button v-if="canEnterPortal" @click="confirmPortal" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-full shadow-lg border-2 border-blue-400 animate-bounce">
                    Enter Portal (F)
                </button>
                <button v-if="canInteractNpc" @click="interactNpc" class="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-6 rounded-full shadow-lg border-2 border-yellow-400 animate-bounce">
                    Talk to {{ closestNpc?.name }} (F)
                </button>
                <button v-if="canGather" @click="startGathering" class="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-full shadow-lg border-2 border-teal-400 animate-bounce">
                    Gather {{ closestResource?.name }} (F)
                </button>
            </div>

            <!-- GATHERING PROGRESS -->
            <div v-if="isGathering" class="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center">
                 <div class="w-48 h-4 bg-gray-900 border-2 border-teal-500 rounded-full overflow-hidden shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                     <div class="h-full bg-teal-500 transition-all ease-linear" :style="{ width: gatherProgress + '%' }"></div>
                 </div>
                 <span class="text-teal-400 font-bold text-xs mt-1 shadow-black drop-shadow-md">Gathering...</span>
            </div>
            

        </div>
    `,
    setup(props, { emit }) {
        const container = ref(null);
        const minimapCanvas = ref(null);
        const fps = ref(0);
        const cameraZoom = ref(10);

        const handleWheel = (e) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY) * 2;
            cameraZoom.value = Math.max(5, Math.min(50, cameraZoom.value + delta));
            onWindowResize();
        };
        const canEnterPortal = ref(false);
        const pendingPortal = ref(null);
        const canInteractNpc = ref(false);
        const closestNpc = ref(null);
        const canGather = ref(false);
        const closestResource = ref(null);
        const isGathering = ref(false);
        const gatherProgress = ref(0);
        const resourceCooldowns = ref({}); // Added
        const entityLabels = ref([]);

        // Socket Listener
        const handleWsMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'resource_update' && data.status === 'cooldown') {
                    resourceCooldowns.value[data.resource_id] = Date.now() + (data.respawn_time * 1000);
                    // Immediate cleanup if valid
                    const mesh = meshes.get(data.resource_id);
                    if (mesh) {
                        scene.remove(mesh);
                        meshes.delete(data.resource_id);
                    }
                }
            } catch (e) { }
        };
        watch(() => socket.value, (newSocket) => {
            if (newSocket) {
                newSocket.addEventListener('message', handleWsMessage);
            }
        }, { immediate: true });

        // Three.js variables
        let scene, camera, renderer, raycaster, mouse;
        let groundPlane;
        let animationId;

        // Entity Meshes Map: ID -> Mesh
        const meshes = new Map();

        // --- ANIMATION SYSTEM ---
        const fbxLoader = new FBXLoader();
        const clock = new THREE.Clock();
        const mixers = [];

        // Animation Maps: ID -> { mixer: Mixer, actions: { idle, run, attack }, currentAction }
        const playerAnimations = new Map();

        const loadPlayerModel = (playerData, material, id) => {
            const group = new THREE.Group();
            group.userData = { type: 'player', entity: playerData };

            // Add Placeholder
            const placeholder = new THREE.Mesh(geometries.player, material);
            placeholder.castShadow = true;
            group.add(placeholder);

            const basePath = `/characters/${playerData.p_class.toLowerCase()}`;

            fbxLoader.load(`${basePath}/idle2.fbx`, (object) => {
                // Remove placeholder
                group.remove(placeholder);

                // Process Model
                object.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = false;
                    }
                });

                // Scale (Auto-fit to height ~3.5)
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const scale = 3.5 / size.y;
                object.scale.set(scale, scale, scale);
                object.position.y = 0;

                group.add(object);

                // Setup Mixer
                const mixer = new THREE.AnimationMixer(object);
                const anims = { idle: null, run: null, attack: null };

                // Track this player's animations
                playerAnimations.set(id, { mixer, actions: anims, currentAction: null });
                mixers.push(mixer);

                // Idle Action
                if (object.animations.length > 0) {
                    const action = mixer.clipAction(object.animations[0]);
                    anims.idle = action;
                    action.play();
                    playerAnimations.get(id).currentAction = action;
                }

                // Load Run
                fbxLoader.load(`${basePath}/running.fbx`, (anim) => {
                    if (anim.animations.length > 0) anims.run = mixer.clipAction(anim.animations[0]);
                });

                // Load Attack
                fbxLoader.load(`${basePath}/attack1.fbx`, (anim) => {
                    if (anim.animations.length > 0) {
                        const action = mixer.clipAction(anim.animations[0]);
                        action.loop = THREE.LoopRepeat;
                        action.timeScale = 3.5;
                        anims.attack = action;
                    }
                });
            }, undefined, (error) => {
                console.error("Failed to load model:", error);
            });

            return group;
        };

        // Local Cache for Templates (Group + Clips)
        const modelCache = new Map();
        const pendingLoads = new Map();

        const loadTemplate = (folderName) => {
            if (modelCache.has(folderName)) return Promise.resolve(modelCache.get(folderName));
            if (pendingLoads.has(folderName)) return pendingLoads.get(folderName);

            const promise = new Promise((resolve, reject) => {
                const path = `/characters/${folderName}`;
                const data = { group: null, clips: {}, height: 0 };

                fbxLoader.load(`${path}/idle.fbx`, (object) => {
                    // Normalize
                    const box = new THREE.Box3().setFromObject(object);
                    const size = box.getSize(new THREE.Vector3());
                    data.height = size.y;
                    data.group = object; // Base Model

                    if (object.animations.length > 0) data.clips.idle = object.animations[0];

                    // Load Run (Parallel)
                    const p1 = new Promise(r => {
                        fbxLoader.load(`${path}/running.fbx`, (anim) => {
                            if (anim.animations.length > 0) {
                                const clip = anim.animations[0];
                                clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'));
                                data.clips.run = clip;
                            }
                            r();
                        }, undefined, r);
                    });

                    // Load Attack
                    const p2 = new Promise(r => {
                        fbxLoader.load(`${path}/attack1.fbx`, (anim) => {
                            if (anim.animations.length > 0) data.clips.attack = anim.animations[0];
                            r();
                        }, undefined, r);
                    });

                    Promise.all([p1, p2]).then(() => resolve(data));

                }, undefined, reject);
            });

            pendingLoads.set(folderName, promise);
            return promise.then(data => {
                modelCache.set(folderName, data);
                pendingLoads.delete(folderName);
                return data;
            }).catch(e => {
                pendingLoads.delete(folderName);
                throw e;
            });
        };

        const loadMonsterModel = (monster, pid) => {
            const group = new THREE.Group();

            // Placeholder cylinder
            const placeholder = new THREE.Mesh(geometries.monster, materials.monster);
            placeholder.position.y = 0.75;
            group.add(placeholder);

            const folderName = monster.template_id;

            loadTemplate(folderName).then(cached => {
                // If group removed from scene, abort
                // But difficult to check here effectively without cleaning up?
                // Just proceed.
                group.remove(placeholder);

                // Clone using SkeletonUtils to allow independent animation
                const object = SkeletonUtils.clone(cached.group);

                object.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Auto-scale
                const baseHeight = 3.0;
                const customScale = monster.model_scale || 1.0;
                const scale = (baseHeight / cached.height) * customScale;
                object.scale.set(scale, scale, scale);
                object.position.y = 0;

                group.add(object);

                // Animation
                const mixer = new THREE.AnimationMixer(object);
                mixers.push(mixer);
                group.userData.mixer = mixer;

                const anims = { idle: null, run: null, attack: null };

                if (cached.clips.idle) {
                    const action = mixer.clipAction(cached.clips.idle);
                    action.play();
                    anims.idle = action;
                    group.userData.currentAction = action;
                }
                if (cached.clips.run) {
                    anims.run = mixer.clipAction(cached.clips.run);
                }
                if (cached.clips.attack) {
                    const act = mixer.clipAction(cached.clips.attack);
                    act.timeScale = 1.5;
                    anims.attack = act;
                }
                group.userData.anims = anims;
            }).catch(err => {
                // console.warn(`Fallback for ${folderName}`, err);
                // Keep placeholder
            });

            return group;
        };

        const keys = { w: false, a: false, s: false, d: false };
        let lastMoveTime = 0;

        const formatMapName = (id) => {
            if (!id) return '';
            return id.replace('map_', '').replace('_', ' ').toUpperCase();
        };

        // Shared Resources
        const geometries = {
            player: null,
            monster: null,
            portal: null,
            npc: null
        };
        const materials = {
            player: null,
            otherPlayer: null,
            monster: null,
            npc: null
        };

        const initThree = () => {
            const width = container.value.clientWidth;
            const height = container.value.clientHeight;

            // Initialize Shared Geometries/Materials
            geometries.player = new THREE.BoxGeometry(1, 2, 1);
            geometries.monster = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16);
            geometries.portal = new THREE.TorusGeometry(1, 0.2, 8, 16);
            geometries.npc = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
            geometries.res_box = new THREE.BoxGeometry(1, 1, 1);
            geometries.res_tree = new THREE.CylinderGeometry(0.2, 0.8, 4, 8);
            geometries.res_rock = new THREE.DodecahedronGeometry(0.8, 0);
            geometries.res_flower = new THREE.OctahedronGeometry(0.4, 0);

            materials.player = new THREE.MeshStandardMaterial({ color: 0x22c55e });
            materials.otherPlayer = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
            materials.monster = new THREE.MeshStandardMaterial({ color: 0xef4444 });
            materials.npc = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
            materials.resource = new THREE.MeshStandardMaterial({ color: 0xffffff });

            // 1. Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x111827); // Dark gray background

            // 2. Camera (Orthographic for Isometric)
            const aspect = width / height;
            const d = cameraZoom.value;
            camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);

            // Isometric Angle: Look from corner
            camera.position.set(20, 20, 20);
            camera.lookAt(scene.position); // Will be updated to follow player

            // 3. Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
            renderer.setSize(width, height);
            renderer.shadowMap.enabled = false;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
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

            // Default Material (Fallback)
            const defaultMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
            groundPlane = new THREE.Mesh(geometry, defaultMat);
            groundPlane.rotation.x = -Math.PI / 2;
            groundPlane.position.set(50, 0, 50);
            groundPlane.receiveShadow = true;
            scene.add(groundPlane);

            // Watch for Map Data changes to update texture
            watch(() => currentMapData.value, (newData) => {
                if (newData && newData.texture) {
                    const loader = new THREE.TextureLoader();
                    // texture field already contains "floor/filename.png", so just append to base /maps/
                    loader.load(`http://localhost:8000/maps/${newData.texture}`, (tex) => {
                        tex.wrapS = THREE.RepeatWrapping;
                        tex.wrapT = THREE.RepeatWrapping;


                        // User Logic: Size Factor. 1 = Small (100 reps). 10 = Large (10 reps).
                        const sizeFactor = newData.texture_scale || 10;
                        const repeats = 100 / Math.max(1, sizeFactor);
                        tex.repeat.set(repeats, repeats);

                        const newMat = new THREE.MeshStandardMaterial({
                            map: tex,
                            side: THREE.DoubleSide,
                            roughness: 0.8,
                            metalness: 0.2
                        });
                        groundPlane.material = newMat;
                        groundPlane.material.needsUpdate = true;
                    }, undefined, (err) => {
                        console.error("Error loading floor texture:", err);
                        groundPlane.material = defaultMat; // Revert on error
                    });
                } else {
                    groundPlane.material = defaultMat;
                }
            }, { deep: true, immediate: true });


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
            container.value.addEventListener('wheel', handleWheel);
        };

        const onWindowResize = () => {
            if (!container.value) return;
            const width = container.value.clientWidth;
            const height = container.value.clientHeight;
            const aspect = width / height;
            const d = cameraZoom.value;

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
                        stopAutoFarm(false);

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

                    stopAutoFarm(false);
                    destinationMarker.value = { x: gameX, y: gameY, time: Date.now(), isGameCoords: true };
                    api.movePlayer(player.value.current_map_id, gameX, gameY);

                    setTimeout(() => destinationMarker.value = null, 500);
                    return;
                }
            }
        };

        const updateEntityLifecycle = () => {
            if (!scene || !geometries.player) return;
            const validIds = new Set();

            // 1. Local Player
            if (player.value) {
                const pid = player.value.id;
                validIds.add(pid);
                let mesh = meshes.get(pid);
                if (!mesh) {
                    if (player.value.p_class && player.value.p_class.toLowerCase() === 'warrior') {
                        mesh = loadPlayerModel(player.value, materials.player, pid);
                    } else {
                        mesh = new THREE.Mesh(geometries.player, materials.player);
                        mesh.castShadow = true;
                        mesh.userData = { type: 'player', entity: player.value };
                        mesh.position.set(player.value.position.x, 1, player.value.position.y);
                    }
                    if (!mesh.parent) scene.add(mesh);
                    meshes.set(pid, mesh);
                }
                mesh.userData.entity = player.value;
            }

            // 2. Other Players
            mapPlayers.value.forEach(p => {
                if (player.value && p.id === player.value.id) return;
                validIds.add(p.id);
                let mesh = meshes.get(p.id);
                if (!mesh) {
                    if (p.p_class && p.p_class.toLowerCase() === 'warrior') {
                        mesh = loadPlayerModel(p, materials.otherPlayer, p.id);
                    } else {
                        mesh = new THREE.Mesh(geometries.player, materials.otherPlayer);
                        mesh.castShadow = true;
                        mesh.userData = { type: 'player', entity: p };
                        mesh.position.set(p.position.x, 1, p.position.y);
                    }
                    if (!mesh.parent) scene.add(mesh);
                    meshes.set(p.id, mesh);
                }
                mesh.userData.entity = p;
            });

            // 3. Monsters
            mapMonsters.value.forEach(m => {
                if (m.stats && m.stats.hp <= 0) return; // Only show living monsters
                validIds.add(m.id);
                let mesh = meshes.get(m.id);
                if (!mesh) {
                    mesh = loadMonsterModel(m, m.id);
                    mesh.castShadow = true;
                    mesh.userData = { type: 'monster', entity: m };
                    mesh.position.set(m.position_x, 0, m.position_y);
                    if (!mesh.parent) scene.add(mesh);
                    meshes.set(m.id, mesh);
                }
                mesh.userData.entity = m;
            });

            // 4. Portals
            if (currentMapData.value && currentMapData.value.portals) {
                currentMapData.value.portals.forEach(portal => {
                    const pid = `portal_${portal.id}`;
                    validIds.add(pid);
                    let mesh = meshes.get(pid);
                    if (!mesh) {
                        const mat = new THREE.MeshStandardMaterial({ color: portal.color || 0xffffff, emissive: portal.color || 0x000000, emissiveIntensity: 0.5 });
                        mesh = new THREE.Mesh(geometries.portal, mat);
                        mesh.rotation.x = 0;
                        mesh.position.set(portal.x, 1, portal.y);
                        mesh.userData = { type: 'portal', entity: { name: portal.label || 'Portal', hp: 0, max_hp: 0 } };
                        scene.add(mesh);
                        meshes.set(pid, mesh);
                    }
                });
            }

            // 5. NPCs
            if (mapNpcs.value) {
                mapNpcs.value.forEach(npc => {
                    validIds.add(npc.id);
                    let mesh = meshes.get(npc.id);
                    if (!mesh) {
                        mesh = new THREE.Mesh(geometries.npc, materials.npc);
                        mesh.castShadow = true;
                        mesh.userData = { type: 'npc', entity: npc };
                        mesh.position.set(npc.x, 1, npc.y);
                        scene.add(mesh);
                        meshes.set(npc.id, mesh);
                    }
                    mesh.position.set(npc.x, 1, npc.y);
                });
            }

            // 6. Resources
            if (currentMapData.value && currentMapData.value.resources) {
                currentMapData.value.resources.forEach(res => {
                    if (resourceCooldowns.value[res.id] && Date.now() < resourceCooldowns.value[res.id]) return;
                    const rid = res.id;
                    validIds.add(rid);
                    let mesh = meshes.get(rid);
                    if (!mesh) {
                        let geom = geometries.res_box;
                        let yOff = 0.5;
                        if (res.type === 'tree') { geom = geometries.res_tree; yOff = 2; }
                        else if (res.type === 'rock') { geom = geometries.res_rock; yOff = 0.4; }
                        else if (res.type === 'flower') { geom = geometries.res_flower; yOff = 0.2; }

                        const mat = new THREE.MeshStandardMaterial({ color: res.color || 0x8B4513 });
                        mesh = new THREE.Mesh(geom, mat);
                        mesh.castShadow = true;
                        mesh.userData = { type: 'resource', entity: res };
                        mesh.position.set(res.x, yOff, res.y);
                        scene.add(mesh);
                        meshes.set(rid, mesh);
                    }
                });
            }

            // Cleanup
            for (const [id, mesh] of meshes) {
                if (!validIds.has(id)) {
                    scene.remove(mesh);
                    if (id.toString().startsWith('portal_') || id.toString().startsWith('res_')) {
                        mesh.material.dispose();
                    }
                    meshes.delete(id);
                }
            }
        };

        const updateEntityPositions = () => {
            if (!scene) return;
            const LERP_FACTOR = 0.15;

            for (const [id, mesh] of meshes) {
                const entity = mesh.userData.entity;
                if (!entity) continue;

                // Player or Monster
                if (mesh.userData.type === 'player' || mesh.userData.type === 'monster') {
                    // Target Position
                    let targetX, targetZ;

                    if (mesh.userData.type === 'player') {
                        targetX = entity.position.x;
                        targetZ = entity.position.y;
                    } else { // Monster
                        targetX = entity.position_x;
                        targetZ = entity.position_y;
                    }

                    // Interpolate
                    const dx = targetX - mesh.position.x;
                    const dz = targetZ - mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    // Is Moving?
                    let isMoving = dist > 0.05;

                    if (mesh.userData.type === 'player' && entity.id === player.value?.id) {
                        const isKeys = (keys.w || keys.a || keys.s || keys.d);
                        if (!isKeys && dist < 0.2) {
                            mesh.position.x = targetX;
                            mesh.position.z = targetZ;
                            isMoving = false;
                        } else {
                            isMoving = dist > 0.1 || isKeys;
                        }

                        // Teleport check
                        if (dist > 10) {
                            mesh.position.x = targetX;
                            mesh.position.z = targetZ;
                            camera.position.x = targetX + 20;
                            camera.position.z = targetZ + 20;
                            camera.lookAt(targetX, 0, targetZ);
                        } else {
                            mesh.position.x += (targetX - mesh.position.x) * LERP_FACTOR;
                            mesh.position.z += (targetZ - mesh.position.z) * LERP_FACTOR;

                            // Camera Follow
                            const targetCamX = mesh.position.x + 20;
                            const targetCamZ = mesh.position.z + 20;
                            camera.position.x += (targetCamX - camera.position.x) * LERP_FACTOR;
                            camera.position.z += (targetCamZ - camera.position.z) * LERP_FACTOR;
                            camera.lookAt(camera.position.x - 20, 0, camera.position.z - 20);
                        }

                    } else { // Other Players & Monsters
                        if (dist > 10) {
                            mesh.position.x = targetX;
                            mesh.position.z = targetZ;
                        } else {
                            mesh.position.x += (targetX - mesh.position.x) * LERP_FACTOR;
                            mesh.position.z += (targetZ - mesh.position.z) * LERP_FACTOR;
                        }
                    }

                    mesh.userData.speed = dist;
                    mesh.userData.isMoving = isMoving;

                    // Rotation
                    if (isMoving) {
                        const angle = Math.atan2(dx, dz);
                        let rotDiff = angle - mesh.rotation.y;
                        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                        mesh.rotation.y += rotDiff * 0.2;
                    } else if (entity.target_id && (entity.state?.toUpperCase() === 'COMBAT' || entity.state?.toUpperCase() === 'ATTACKING')) {
                        // Look at target
                        const targetEntity = meshes.get(entity.target_id)?.userData.entity;
                        if (targetEntity) {
                            const tdx = (targetEntity.position_x || targetEntity.position.x) - mesh.position.x;
                            const tdz = (targetEntity.position_y || targetEntity.position.y) - mesh.position.z;
                            const angle = Math.atan2(tdx, tdz);

                            let rotDiff = angle - mesh.rotation.y;
                            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                            mesh.rotation.y += rotDiff * 0.1;
                        }
                    }
                } else if (mesh.userData.type === 'portal') {
                    // Rotate portal effect
                    mesh.rotation.y += 0.02;
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
                stopAutoFarm(false);
                isFreeFarming.value = false;

                // Normalize vector
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;

                const dist = 5;
                const targetX = player.value.position.x + dx * dist;
                const targetY = player.value.position.y + dy * dist;

                // Rotate Local Player
                const mesh = meshes.get(player.value.id);
                if (mesh) {
                    const angle = Math.atan2(dx, dy);
                    let rotDiff = angle - mesh.rotation.y;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                    mesh.rotation.y += rotDiff * 0.2;
                }

                api.movePlayer(player.value.current_map_id, targetX, targetY);
                lastMoveTime = now;
            } else {
                // Combat Rotation
                const mesh = meshes.get(player.value.id);
                if (mesh && (player.value.state?.toUpperCase() === 'COMBAT' || player.value.state?.toUpperCase() === 'ATTACKING') && player.value.target_id) {
                    const targetMonster = mapMonsters.value.find(m => m.id === player.value.target_id);
                    if (targetMonster) {
                        const tdx = targetMonster.position_x - player.value.position.x;
                        const tdz = targetMonster.position_y - player.value.position.y;
                        const angle = Math.atan2(tdx, tdz);
                        let rotDiff = angle - mesh.rotation.y;
                        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                        mesh.rotation.y += rotDiff * 0.1;
                    }
                }

                if (isFreeFarming.value || activeMission.value) return;

                // If keys released and we are technically in moving state, send stop
                // This ensures server knows we stopped intentionally
                if (player.value.state && player.value.state.toLowerCase() === 'moving') {
                    player.value.state = 'idle';
                    if (mesh) mesh.userData.isMoving = false;

                    api.stopMovement();
                    lastMoveTime = now;
                }
            }
        };

        const checkInteractions = () => {
            if (!player.value || !currentMapData.value) return;
            const p = player.value.position;

            // Portals
            let closestDist = 999;
            let closestP = null;

            if (currentMapData.value.portals) {
                for (const portal of currentMapData.value.portals) {
                    const dist = Math.sqrt((p.x - portal.x) ** 2 + (p.y - portal.y) ** 2);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestP = portal;
                    }
                }
            }

            if (closestP && closestDist < 3.0) {
                canEnterPortal.value = true;
                pendingPortal.value = closestP;
            } else {
                canEnterPortal.value = false;
                pendingPortal.value = null;
            }

            // NPCs
            let npcDist = 999;
            let closestN = null;
            if (mapNpcs.value) {
                for (const npc of mapNpcs.value) {
                    const dist = Math.sqrt((p.x - npc.x) ** 2 + (p.y - npc.y) ** 2);
                    if (dist < npcDist) {
                        npcDist = dist;
                        closestN = npc;
                    }
                }
            }

            if (closestN && npcDist < 3.0) {
                canInteractNpc.value = true;
                closestNpc.value = closestN;
            } else {
                canInteractNpc.value = false;
                closestNpc.value = null;
            }

            // Resources
            let resDist = 999;
            let closestR = null;
            if (currentMapData.value.resources) {
                for (const res of currentMapData.value.resources) {
                    const dist = Math.sqrt((p.x - res.x) ** 2 + (p.y - res.y) ** 2);
                    if (dist < resDist) {
                        resDist = dist;
                        closestR = res;
                    }
                }
            }

            if (closestR && resDist < 3.0) {
                canGather.value = true;
                closestResource.value = closestR;
            } else {
                canGather.value = false;
                closestResource.value = null;
            }
        };

        const startGathering = async () => {
            if (!closestResource.value || isGathering.value) return;
            isGathering.value = true;
            gatherProgress.value = 0;
            const totalTime = 2000;
            const interval = 50;
            const step = (interval / totalTime) * 100;

            const timer = setInterval(async () => {
                gatherProgress.value += step;
                if (gatherProgress.value >= 100) {
                    clearInterval(timer);
                    isGathering.value = false;
                    try {
                        const res = await fetch(`http://localhost:8000/player/${player.value.id}/gather?resource_id=${closestResource.value.id}`, { method: 'POST' });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.loot) {
                                let lootMsg = [];
                                data.loot.forEach(l => {
                                    // Assuming item name is basically available or raw ID
                                    showGameAlert(`+${l.qty} ${l.item_id}`, 'drop', '🌿');
                                    lootMsg.push(`${l.qty}x ${l.item_id}`);
                                });
                                addLog(`Gathered: ${lootMsg.join(', ')}`, 'text-green-400');
                            }
                        } else {
                            const err = await res.json();
                            showGameAlert(err.detail || "Gather failed", 'error', '❌');
                            addLog(err.detail || "Gather failed", "error");
                        }
                    } catch (e) {
                        showGameAlert("Error gathering", 'error');
                        addLog("Error gathering", "error");
                    }
                }
            }, interval);
        };

        const confirmPortal = async () => {
            if (pendingPortal.value) {
                const target = pendingPortal.value.targetMap || pendingPortal.value.target_map_id;
                // Use target coordinates if available, otherwise current (fallback, though unlikely desired)
                const tx = pendingPortal.value.target_x !== undefined ? pendingPortal.value.target_x : pendingPortal.value.x;
                const ty = pendingPortal.value.target_y !== undefined ? pendingPortal.value.target_y : pendingPortal.value.y;

                if (target) {
                    await api.movePlayer(target, tx, ty);
                    canEnterPortal.value = false;
                }
            }
        };

        const interactNpc = () => {
            if (closestNpc.value) {
                emit('interact-npc', closestNpc.value);
            }
        };

        const toggleAutoAttack = () => {
            if (isFreeFarming.value) {
                stopAutoFarm();
                addLog("Auto Attack Disabled", "text-red-400");
            } else {
                // Sync selected map to current map so we farm HERE
                if (player.value) {
                    selectedMapId.value = player.value.current_map_id;
                }
                // Clear specific target so we attack anything nearby
                selectedTargetId.value = null;

                isFreeFarming.value = true;
                checkAndAct();
                addLog("Auto Attack Enabled", "text-green-400");
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = true;
            if (e.key === 'a' || e.key === 'A') keys.a = true;
            if (e.key === 's' || e.key === 'S') keys.s = true;
            if (e.key === 'd' || e.key === 'D') keys.d = true;
            if (e.key === 'f' || e.key === 'F') {
                if (canEnterPortal.value) confirmPortal();
                else if (canInteractNpc.value) interactNpc();
                else if (canGather.value) startGathering();
            }

        };

        const handleKeyUp = (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = false;
            if (e.key === 'a' || e.key === 'A') keys.a = false;
            if (e.key === 's' || e.key === 'S') keys.s = false;
            if (e.key === 'd' || e.key === 'D') keys.d = false;
        };

        const tempVec = new THREE.Vector3();

        const toScreenPosition = (obj) => {
            if (!container.value) return { x: 0, y: 0 };

            obj.updateMatrixWorld();
            tempVec.setFromMatrixPosition(obj.matrixWorld);

            // Offset based on type
            const offset = obj.userData.type === 'player' ? 4.0 : (obj.userData.type === 'portal' ? 3.0 : (obj.userData.type === 'npc' ? 3.2 : 2.5));
            tempVec.y += offset;

            tempVec.project(camera);

            const widthHalf = 0.5 * container.value.clientWidth;
            const heightHalf = 0.5 * container.value.clientHeight;

            return {
                x: (tempVec.x * widthHalf) + widthHalf,
                y: -(tempVec.y * heightHalf) + heightHalf
            };
        };

        let frameCount = 0;
        let lastFpsTime = performance.now();
        let lastLabelUpdate = 0;

        const animate = () => {
            animationId = requestAnimationFrame(animate);

            // Minimap
            drawMinimap();

            updateEntityPositions();

            // Clear Monster Card if invalid conditions
            if (currentMonster.value) {
                // 1. Monster dead or missing
                const liveM = mapMonsters.value.find(m => m.id === currentMonster.value.id);
                if (!liveM || (liveM.stats && liveM.stats.hp <= 0)) {
                    currentMonster.value = null;
                }
                // 2. Player no longer targeting it OR player no longer in combat
                else if (player.value) {
                    // If we switched target, currentMonster usually updates, but if we cleared target:
                    if (!player.value.target_id) currentMonster.value = null;

                    // If we are IDLE/MOVING (escaped), clear card
                    const state = (player.value.state || '').toUpperCase();
                    if (state !== 'COMBAT' && state !== 'ATTACKING') {
                        currentMonster.value = null;
                    }
                }
            }

            // Update Animations
            const delta = clock.getDelta();
            mixers.forEach(m => m.update(delta));

            // State Machine for Player Animations (ALL Players)
            for (const [id, animData] of playerAnimations) {
                // Find entity data
                let entity = null;
                if (player.value && player.value.id === id) entity = player.value;
                else entity = mapPlayers.value.find(p => p.id === id);

                if (!entity) continue;

                const mesh = meshes.get(id);
                if (!mesh) continue;

                const isMoving = mesh.userData ? mesh.userData.isMoving : false;

                const { actions, currentAction } = animData;
                let desired = actions.idle;
                if (!desired) continue;

                const state = (entity.state || 'IDLE').toUpperCase();
                const speed = mesh.userData.speed || 0;

                if (state === 'COMBAT' && actions.attack) {
                    if (speed > 0.5) desired = actions.run;
                    else desired = actions.attack;
                }
                else if ((state === 'MOVING' || isMoving) && actions.run) {
                    desired = actions.run;
                }

                if (desired && desired !== currentAction) {
                    if (desired === actions.attack) desired.reset();

                    if (currentAction) currentAction.fadeOut(0.2);
                    desired.reset().fadeIn(0.2).play();
                    animData.currentAction = desired;
                }
            }

            updateMovement();
            checkInteractions();

            renderer.render(scene, camera);

            // FPS
            const now = performance.now();
            frameCount++;
            if (now - lastFpsTime >= 1000) {
                fps.value = frameCount;
                frameCount = 0;
                lastFpsTime = now;
            }

            // Update Labels (Throttled to ~15 FPS)
            const nowTime = performance.now();
            if (nowTime - lastLabelUpdate > 16) { // ~60 FPS for smoothness
                lastLabelUpdate = nowTime;
                const labels = [];
                for (const [id, mesh] of meshes) {
                    if (!mesh.visible) continue;

                    // Optimization: Check distance quickly before projection?
                    // For now, throttle is the biggest win.

                    const pos = toScreenPosition(mesh);
                    if (pos.x < -50 || pos.x > container.value.clientWidth + 50 ||
                        pos.y < -50 || pos.y > container.value.clientHeight + 50) continue;

                    const entity = mesh.userData.entity;
                    if (entity) {
                        labels.push({
                            id: id,
                            x: Math.round(pos.x),
                            y: Math.round(pos.y),
                            name: entity.name,
                            hp: entity.stats ? entity.stats.hp : (entity.hp || 0),
                            max_hp: entity.stats ? entity.stats.max_hp : (entity.max_hp || 0),
                            type: mesh.userData.type,
                            isPlayer: mesh.userData.type === 'player'
                        });
                    }
                }
                entityLabels.value = labels;
            }
        };

        const drawMinimap = () => {
            if (!minimapCanvas.value || !player.value) return;
            const ctx = minimapCanvas.value.getContext('2d');
            const w = minimapCanvas.value.width;
            const h = minimapCanvas.value.height;

            // Background
            ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
            ctx.fillRect(0, 0, w, h);

            const scale = w / 100; // Map Size 100x100

            const drawDot = (x, z, color, size = 2) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x * scale, z * scale, size, 0, Math.PI * 2);
                ctx.fill();
            };

            // Resources
            if (currentMapData.value && currentMapData.value.resources) {
                currentMapData.value.resources.forEach(r => drawDot(r.x, r.y, '#0ea5e9', 1.5));
            }
            // Portals
            if (currentMapData.value && currentMapData.value.portals) {
                currentMapData.value.portals.forEach(p => drawDot(p.x, p.y, '#d8b4fe', 3));
            }
            // Monsters
            mapMonsters.value.forEach(m => {
                if (m.stats && m.stats.hp > 0) drawDot(m.position_x, m.position_y, '#ef4444', 2);
            });
            // NPCs
            if (mapNpcs.value) {
                mapNpcs.value.forEach(n => drawDot(n.x, n.y, '#facc15', 2.5));
            }
            // Other Players
            mapPlayers.value.forEach(p => {
                if (p.id !== player.value.id) drawDot(p.position.x, p.position.y, '#60a5fa', 2);
            });
            // Self
            if (player.value && player.value.position) {
                drawDot(player.value.position.x, player.value.position.y, '#4ade80', 3);
                // Direction Indicator
                const rot = meshes.get(player.value.id)?.rotation.y || 0;
                ctx.beginPath();
                ctx.moveTo(player.value.position.x * scale, player.value.position.y * scale);
                ctx.lineTo(
                    (player.value.position.x + Math.sin(rot) * 5) * scale,
                    (player.value.position.y + Math.cos(rot) * 5) * scale
                );
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        };

        watch(() => player.value?.current_map_id, async (newMapId) => {
            if (newMapId) {
                // Only stop auto-farm if we moved to a map that wasn't our target
                if (newMapId !== selectedMapId.value) {
                    stopAutoFarm();
                }

                await api.fetchMapMonsters(newMapId);
                api.fetchMapPlayers(newMapId);

                // Fetch NPCs
                try {
                    const res = await fetch(`http://localhost:8000/map/${newMapId}/npcs`);
                    if (res.ok) mapNpcs.value = await res.json();
                } catch (e) { console.error(e); }

                try {
                    const res = await fetch(`http://localhost:8000/map/${newMapId}`);
                    if (res.ok) {
                        const mapData = await res.json();
                        currentMapData.value = mapData;

                        // Process initial cooldowns
                        if (mapData.active_cooldowns) {
                            Object.entries(mapData.active_cooldowns).forEach(([rid, remSeconds]) => {
                                resourceCooldowns.value[rid] = Date.now() + (remSeconds * 1000);
                            });
                        }
                    }
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

        watch(mapPlayers, () => updateEntityLifecycle(), { deep: true });
        watch(mapMonsters, () => updateEntityLifecycle(), { deep: true });
        watch(() => player.value?.current_map_id, () => updateEntityLifecycle()); // Map Change

        onMounted(() => {
            // Init check
            setTimeout(updateEntityLifecycle, 500);
        });

        return {
            container,
            minimapCanvas,
            player,
            currentMonster,
            formatMapName,
            canEnterPortal, confirmPortal,
            isFreeFarming,
            fps,
            toggleAutoAttack,
            canInteractNpc, closestNpc, interactNpc,
            canGather, closestResource, startGathering, isGathering, gatherProgress,
            entityLabels
        };
    }
};
