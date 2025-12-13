
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import {
    player, currentMonster, isFreeFarming, addAlert, addLog, socket,
    mapPlayers, mapMonsters, mapNpcs, currentMapData
} from '../state.js';
import { api } from '../services/api.js';
import { API_BASE_URL } from '../config.js';

import { useGameRenderer } from '../composables/useGameRenderer.js';
import { useGameEntities } from '../composables/useGameEntities.js';
import { useGameInteractions } from '../composables/useGameInteractions.js';
import { useGameInput } from '../composables/useGameInput.js';
import { useGameCombatEvents } from '../composables/useGameCombatEvents.js';

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

        <!-- Floating Combat Text (FCT) -->
        <div v-for="ft in floatingTexts" :key="ft.id"
            class="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 font-black z-40 text-shadow-heavy whitespace-nowrap"
            :class="{
                'text-orange-400 text-2xl': ft.type === 'crit',
                'text-white text-xl': ft.type === 'normal',
                'text-red-500 text-xl': ft.type === 'monster_dmg',
                'text-green-400 text-xl': ft.type === 'heal',
                'text-red-400 text-xl': ft.type === 'lifesteal'
            }"
            :style="{ 
                left: ft.x + 'px', 
                top: ft.y + 'px', 
                opacity: ft.opacity,
                transform: 'scale(' + ft.scale + ') translate(-50%, -50%)'
            }">
            <span v-if="ft.type === 'crit'" class="text-xs uppercase text-yellow-300 block text-center leading-none mb-[-2px]">Critical</span>
            {{ ft.text }}
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
        // --- 1. Renderer System ---
        const {
            container, minimapCanvas, cameraZoom,
            scene, getCamera, getRenderer,
            geometries, materials,
            initThree, drawMinimap, toScreenPosition
        } = useGameRenderer();

        // --- 2. Interaction System ---
        const interactions = useGameInteractions(emit);
        const {
            canEnterPortal, pendingPortal,
            canInteractNpc, closestNpc, interactNpc, confirmPortal,
            canGather, closestResource, startGathering, isGathering, gatherProgress,
            resourceCooldowns, checkInteractions, toggleAutoAttack
        } = interactions;

        // --- 3. Entity System ---
        const {
            meshes, updateEntityLifecycle, updateEntityPositions, updateAnimations, clock
        } = useGameEntities(scene, geometries, materials, resourceCooldowns);

        // --- 4. Input System ---
        const { updateMovement, keys } = useGameInput(scene, meshes, getCamera, getRenderer, container, interactions);

        // --- 5. Combat Events (FCT) ---
        const {
            floatingTexts,
            handleCombatUpdate,
            updateFloatingTexts
        } = useGameCombatEvents(toScreenPosition, meshes);

        // --- 6. FX & Local Logic ---
        const fps = ref(0);
        const entityLabels = ref([]);
        let animationId;

        const formatMapName = (id) => {
            if (!id) return '';
            return id.replace('map_', '').replace('_', ' ').toUpperCase();
        };

        const createLevelUpEffect = (targetId) => {
            let mesh = meshes.get(targetId);
            if (!mesh) mesh = meshes.get(Number(targetId));
            if (!mesh) mesh = meshes.get(String(targetId));

            if (!mesh) {
                console.warn(`LevelUp Effect: Mesh not found for ID ${targetId}. Available:`, [...meshes.keys()]);
                return;
            }

            // 1. Golden Aura
            const geometry = new THREE.TorusGeometry(1, 0.1, 16, 100);
            const material = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8 });
            const aura = new THREE.Mesh(geometry, material);
            aura.position.copy(mesh.position);
            aura.position.y += 0.5;
            aura.rotation.x = Math.PI / 2;
            scene.add(aura);

            // 2. Rising Particles
            const particleCount = 20;
            const particles = [];
            const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const pMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

            for (let i = 0; i < particleCount; i++) {
                const p = new THREE.Mesh(pGeo, pMat);
                p.position.copy(mesh.position);
                p.position.x += (Math.random() - 0.5) * 1.5;
                p.position.z += (Math.random() - 0.5) * 1.5;
                p.position.y += Math.random();
                scene.add(p);
                particles.push({ mesh: p, speed: 0.05 + Math.random() * 0.05 });
            }

            // Animate
            let scale = 1;
            let opacity = 0.8;

            const animateFx = () => {
                scale += 0.05;
                opacity -= 0.02;

                // Aura Expansion
                aura.scale.set(scale, scale, 1);
                aura.material.opacity = opacity;

                // Particles Rising
                particles.forEach(pObj => {
                    pObj.mesh.position.y += pObj.speed;
                    pObj.mesh.rotation.x += 0.1;
                    pObj.mesh.rotation.y += 0.1;
                });

                if (opacity > 0) {
                    requestAnimationFrame(animateFx);
                } else {
                    scene.remove(aura);
                    particles.forEach(p => scene.remove(p.mesh));
                }
            };
            requestAnimationFrame(animateFx);

            // UI Alert (Only for self)
            if (String(targetId) === String(player.value.id)) {
                addLog(`Level Up!`, 'text-yellow-400 font-bold text-xl');
                addAlert("LEVEL UP!", "levelup", "✨", `Level ${player.value?.level || '?'}`);
            }

            // Audio Effect
            try {
                const audio = new Audio('/public/sounds/levelup.wav');
                audio.volume = 0.5;
                audio.play().catch(e => console.warn("Audio play failed:", e));
            } catch (e) { console.error("Audio error:", e); }
        };

        const handleWsMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'resource_update' && data.status === 'cooldown') {
                    resourceCooldowns.value[data.resource_id] = Date.now() + (data.respawn_time * 1000);
                    const mesh = meshes.get(data.resource_id);
                    if (mesh) {
                        scene.remove(mesh);
                        meshes.delete(data.resource_id);
                    }
                } else if (data.type === 'level_up') {
                    createLevelUpEffect(data.player_id);
                    if (data.player_id === player.value.id) {
                        player.value.level = data.new_level;
                    }
                } else if (data.type === 'combat_update') {
                    // DELEGATE TO FCT
                    handleCombatUpdate(data);
                }
            } catch (e) { }
        };

        watch(() => socket.value, (newSocket) => {
            if (newSocket) {
                newSocket.addEventListener('message', handleWsMessage);
            }
        }, { immediate: true });

        // Restore Map Transition Logic
        watch(() => player.value?.current_map_id, async (newMapId) => {
            if (newMapId) {
                if (isFreeFarming.value) {
                    // Check if valid? For now just rely on autoFarm service
                }

                await api.fetchMapMonsters(newMapId);
                api.fetchMapPlayers(newMapId);

                // Fetch NPCs
                try {
                    const res = await fetch(`${API_BASE_URL}/map/${newMapId}/npcs`);
                    if (res.ok) mapNpcs.value = await res.json();
                } catch (e) { console.error(e); }

                // Fetch Map Data
                try {
                    const res = await fetch(`${API_BASE_URL}/map/${newMapId}`);
                    if (res.ok) currentMapData.value = await res.json();
                } catch (e) { console.error(e); }
            }
        }, { immediate: true });


        // toScreenPosition is now imported from useGameRenderer

        // --- 6. Main Loop ---
        let frameCount = 0;
        let lastFpsTime = performance.now();
        let lastLabelUpdate = 0;

        const animate = () => {
            animationId = requestAnimationFrame(animate);

            // 1. Systems Update
            const delta = clock.getDelta();

            drawMinimap(meshes);
            updateEntityPositions(getCamera());
            updateAnimations(delta);
            updateMovement();
            checkInteractions();
            updateFloatingTexts(delta);

            // 2. Render
            const renderer = getRenderer();
            const camera = getCamera();
            if (renderer && camera) {
                renderer.render(scene, camera);
            }

            // 3. FPS
            const now = performance.now();
            frameCount++;
            if (now - lastFpsTime >= 1000) {
                fps.value = frameCount;
                frameCount = 0;
                lastFpsTime = now;
            }

            // 4. Labels (Throttled)
            if (now - lastLabelUpdate > 16) {
                lastLabelUpdate = now;
                const labels = [];
                for (const [id, mesh] of meshes) {
                    if (!mesh.visible) continue;

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

        onMounted(() => {
            setTimeout(() => {
                initThree();
                updateEntityLifecycle();
                animate();
            }, 100);

            if (player.value?.current_map_id) {
                api.fetchMapMonsters(player.value.current_map_id);
                api.fetchMapPlayers(player.value.current_map_id);
            }
        });

        onUnmounted(() => {
            cancelAnimationFrame(animationId);
            const sock = socket.value;
            if (sock) {
                sock.removeEventListener('message', handleWsMessage);
            }
        });

        return {
            container,
            minimapCanvas,
            fps,
            player, // for template
            currentMonster,
            formatMapName,
            // Interactions
            canEnterPortal, confirmPortal,
            canInteractNpc, closestNpc, interactNpc,
            canGather, closestResource, startGathering, isGathering, gatherProgress,
            isFreeFarming, toggleAutoAttack,
            entityLabels,
            floatingTexts
        };
    }
};
