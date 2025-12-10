
import { ref, watch } from 'vue';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { player, mapMonsters, mapPlayers, currentMapData, mapNpcs } from '../state.js';

export function useGameEntities(scene, geometries, materials, resourceCooldowns) {
    // Entity Meshes Map: ID -> Mesh
    const meshes = new Map();

    // Animation System
    const fbxLoader = new FBXLoader();
    const clock = new THREE.Clock(); // Note: This might be better global or per-system
    const mixers = [];
    const playerAnimations = new Map();



    const loadPlayerModel = (playerData, material, id) => {
        const group = new THREE.Group();
        group.userData = { type: 'player', entity: playerData };

        const placeholder = new THREE.Mesh(geometries.player, material);
        placeholder.castShadow = true;
        group.add(placeholder);

        const basePath = `/characters/${playerData.p_class.toLowerCase()}`;

        fbxLoader.load(`${basePath}/idle.fbx`, (object) => {
            group.remove(placeholder);
            object.traverse(child => {
                if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const scale = 3.5 / size.y;
            object.scale.set(scale, scale, scale);
            object.position.y = 0;
            group.add(object);

            const mixer = new THREE.AnimationMixer(object);
            const anims = { idle: null, run: null, attack: null };
            playerAnimations.set(id, { mixer, actions: anims, currentAction: null });
            mixers.push(mixer);

            if (object.animations.length > 0) {
                const action = mixer.clipAction(object.animations[0]);
                anims.idle = action;
                action.play();
                playerAnimations.get(id).currentAction = action;
            }
            // Load other anims
            fbxLoader.load(`${basePath}/running.fbx`, (anim) => {
                if (anim.animations.length > 0) anims.run = mixer.clipAction(anim.animations[0]);
            });
            fbxLoader.load(`${basePath}/attack1.fbx`, (anim) => {
                if (anim.animations.length > 0) {
                    const act = mixer.clipAction(anim.animations[0]);
                    act.loop = THREE.LoopRepeat;
                    act.timeScale = 3.5;
                    anims.attack = act;
                }
            });
        }, undefined, (e) => console.error("Load Player Error", e));

        return group;
    };

    // Cache
    const modelCache = new Map();
    const pendingLoads = new Map();

    const loadTemplate = (folderName) => {
        if (modelCache.has(folderName)) return Promise.resolve(modelCache.get(folderName));
        if (pendingLoads.has(folderName)) return pendingLoads.get(folderName);

        const promise = new Promise((resolve, reject) => {
            const path = `/characters/${folderName}`;
            const data = { group: null, clips: {}, height: 0 };

            // Helper to process loaded model (or dummy)
            function processModel(object) {
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                data.height = size.y || 2; // Default if 0
                data.group = object;

                if (object.animations && object.animations.length > 0) data.clips.idle = object.animations[0];

                // Attempt to load extra animations (run, attack) in parallel, but don't fail if missing
                const p1 = new Promise(r => {
                    fbxLoader.load(`${path}/running.fbx`, (anim) => {
                        if (anim.animations.length > 0) {
                            const clip = anim.animations[0];
                            // Filter position tracks to prevent model jumping out of sync with code
                            clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'));
                            data.clips.run = clip;
                        }
                        r();
                    }, undefined, r); // Resolve on error too
                });

                const p2 = new Promise(r => {
                    fbxLoader.load(`${path}/attack1.fbx`, (anim) => {
                        if (anim.animations.length > 0) data.clips.attack = anim.animations[0];
                        r();
                    }, undefined, r);
                });

                Promise.all([p1, p2]).then(() => resolve(data));
            }

            // Chain: idle -> idle2 -> running -> BOX
            fbxLoader.load(`${path}/idle.fbx`, (object) => {
                processModel(object);
            }, undefined, () => {
                fbxLoader.load(`${path}/idle2.fbx`, (obj2) => processModel(obj2), undefined, () => {
                    fbxLoader.load(`${path}/running.fbx`, (obj3) => processModel(obj3), undefined, () => {
                        // All failed: Use Dummy Box
                        const dummy = new THREE.Mesh(geometries.monster, materials.monster);
                        processModel(dummy);
                    });
                });
            });
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
        // Temporary placeholder while loading
        const placeholder = new THREE.Mesh(geometries.monster, materials.monster);
        placeholder.position.y = 0.75;
        group.add(placeholder);

        loadTemplate(monster.template_id).then(cached => {
            group.remove(placeholder);
            let object;

            if (cached.group.isMesh && cached.group.geometry.type === 'CylinderGeometry') {
                // It's the fallback dummy
                object = cached.group.clone();
            } else {
                // It's an FBX model
                object = SkeletonUtils.clone(cached.group);
            }

            object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });

            const baseHeight = 3.0;
            const customScale = monster.model_scale || 1.0;
            // Avoid division by zero
            const scale = (baseHeight / (cached.height || 1)) * customScale;

            object.scale.set(scale, scale, scale);
            object.position.y = 0;

            // Fix rotation for models (FBX usually look +Z, we need them properly oriented)
            // But cylinder logic might differ.
            if (!cached.group.isMesh) {
                // object.rotation.y = Math.PI; // Adjust if needed
            } else {
                object.position.y = 0.75; // Correct cylinder height
                object.scale.set(1, 1, 1); // Reset scale for basic geom
            }

            group.add(object);

            // Mixer Setup
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
            if (cached.clips.run) anims.run = mixer.clipAction(cached.clips.run);
            if (cached.clips.attack) {
                const act = mixer.clipAction(cached.clips.attack);
                act.timeScale = 1.5;
                anims.attack = act;
            }
            group.userData.anims = anims;
        });
        return group;
    };



    // --- Lifecycle ---
    const updateEntityLifecycle = () => {
        const validIds = new Set();

        // Helper to add/update
        const ensureMesh = (id, type, entity, createFn) => {
            validIds.add(id);
            let mesh = meshes.get(id);
            if (!mesh) {
                mesh = createFn();
                if (!mesh.parent) scene.add(mesh);
                meshes.set(id, mesh);
            }
            mesh.userData.entity = entity; // Update Ref
        };

        // 1. Local Player
        if (player.value) {
            ensureMesh(player.value.id, 'player', player.value, () => {
                if (player.value.p_class?.toLowerCase() === 'warrior') return loadPlayerModel(player.value, materials.player, player.value.id);
                const m = new THREE.Mesh(geometries.player, materials.player);
                m.castShadow = true;
                m.userData = { type: 'player' };
                m.position.set(player.value.position.x, 1, player.value.position.y);
                return m;
            });
        }

        // 2. Others
        mapPlayers.value.forEach(p => {
            if (player.value && p.id === player.value.id) return;
            ensureMesh(p.id, 'player', p, () => {
                if (p.p_class?.toLowerCase() === 'warrior') return loadPlayerModel(p, materials.otherPlayer, p.id);
                const m = new THREE.Mesh(geometries.player, materials.otherPlayer);
                m.castShadow = true;
                m.userData = { type: 'player' };
                m.position.set(p.position.x, 1, p.position.y);
                return m;
            });
        });

        // 3. Monsters
        mapMonsters.value.forEach(m => {
            if (m.stats && m.stats.hp <= 0) return;
            ensureMesh(m.id, 'monster', m, () => {
                const mesh = loadMonsterModel(m, m.id);
                mesh.castShadow = true;
                mesh.userData = { type: 'monster' };
                mesh.position.set(m.position_x, 0, m.position_y);
                return mesh;
            });
        });

        // 4. Portals
        if (currentMapData.value?.portals) {
            currentMapData.value.portals.forEach(portal => {
                const pid = `portal_${portal.id}`;
                ensureMesh(pid, 'portal', portal, () => {
                    const mat = new THREE.MeshStandardMaterial({ color: portal.color || 0xffffff, emissive: portal.color || 0x000000, emissiveIntensity: 0.5 });
                    const m = new THREE.Mesh(geometries.portal, mat);
                    m.position.set(portal.x, 1, portal.y);
                    m.userData = { type: 'portal', entity: { name: portal.label || 'Portal' } };
                    return m;
                });
            });
        }

        // 5. NPCs
        if (mapNpcs.value) {
            mapNpcs.value.forEach(npc => {
                ensureMesh(npc.id, 'npc', npc, () => {
                    const m = new THREE.Mesh(geometries.npc, materials.npc);
                    m.castShadow = true;
                    m.userData = { type: 'npc' };
                    m.position.set(npc.x, 1, npc.y);
                    return m;
                });
            });
        }

        // 6. Resources
        if (currentMapData.value?.resources) {
            currentMapData.value.resources.forEach(res => {
                if (resourceCooldowns.value[res.id] && Date.now() < resourceCooldowns.value[res.id]) return;
                ensureMesh(res.id, 'resource', res, () => {
                    let geom = geometries.res_box;
                    let yOff = 0.5;
                    if (res.type === 'tree') { geom = geometries.res_tree; yOff = 2; }
                    else if (res.type === 'rock') { geom = geometries.res_rock; yOff = 0.4; }
                    else if (res.type === 'flower') { geom = geometries.res_flower; yOff = 0.2; }

                    const mat = new THREE.MeshStandardMaterial({ color: res.color || 0x8B4513 });
                    const m = new THREE.Mesh(geom, mat);
                    m.userData = { type: 'resource' };
                    m.position.set(res.x, yOff, res.y);
                    return m;
                });
            });
        }

        // Cleanup
        for (const [id, mesh] of meshes) {
            if (!validIds.has(id)) {
                scene.remove(mesh);
                if (id.toString().startsWith('portal_') || id.toString().startsWith('res_')) {
                    if (mesh.material) mesh.material.dispose();
                }
                meshes.delete(id);
            }
        }
    };

    // --- Update Loop ---
    const updateEntityPositions = (camera) => {
        const LERP_FACTOR = 0.15;
        // Logic for interpolation...
        for (const [id, mesh] of meshes) {
            const entity = mesh.userData.entity;
            if (!entity) continue;

            if (mesh.userData.type === 'player' || mesh.userData.type === 'monster') {
                let targetX = (mesh.userData.type === 'player') ? entity.position.x : entity.position_x;
                let targetZ = (mesh.userData.type === 'player') ? entity.position.y : entity.position_y;

                const dx = targetX - mesh.position.x;
                const dz = targetZ - mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                let isMoving = dist > 0.05;

                // Local Player Special Logic
                if (mesh.userData.type === 'player' && entity.id === player.value?.id) {
                    // Check key overrides (requires access to keys? or just trust server pos mostly?)
                    // For refactor simplicy: Let's assume server pos is truth mostly, but we smooth it.
                    // IMPORTANT: The Input system might override "isKeys". 
                    // Pass 'isKeys' as arg? Or just ignore for now and trust lerp.
                    // The original code checked keys to prevent jitter.
                    // We will implement a simplified version: If dist large, snap. Else lerp.

                    if (dist > 10) {
                        mesh.position.x = targetX;
                        mesh.position.z = targetZ;
                        if (camera) {
                            camera.position.x = targetX + 20;
                            camera.position.z = targetZ + 20;
                            camera.lookAt(targetX, 0, targetZ);
                        }
                    } else {
                        mesh.position.x += dx * LERP_FACTOR;
                        mesh.position.z += dz * LERP_FACTOR;
                        if (camera) {
                            const tx = mesh.position.x + 20;
                            const tz = mesh.position.z + 20;
                            camera.position.x += (tx - camera.position.x) * LERP_FACTOR;
                            camera.position.z += (tz - camera.position.z) * LERP_FACTOR;
                            camera.lookAt(camera.position.x - 20, 0, camera.position.z - 20);
                        }
                    }
                } else {
                    if (dist > 10) { mesh.position.x = targetX; mesh.position.z = targetZ; }
                    else { mesh.position.x += dx * LERP_FACTOR; mesh.position.z += dz * LERP_FACTOR; }
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
                }

                // Anim Logic (Monster)
                if (mesh.userData.type === 'monster' && mesh.userData.anims) {
                    const anims = mesh.userData.anims;
                    let next = anims.idle;
                    const state = (entity.state || '').toUpperCase();
                    if (state === 'ATTACKING' && anims.attack) next = anims.attack;
                    else if (['CHASING', 'WANDERING', 'RETURNING'].includes(state) && anims.run) next = anims.run;

                    if (next && mesh.userData.currentAction !== next) {
                        if (mesh.userData.currentAction) mesh.userData.currentAction.fadeOut(0.2);
                        next.reset().fadeIn(0.2).play();
                        mesh.userData.currentAction = next;
                    }
                }
            } else if (mesh.userData.type === 'portal') {
                mesh.rotation.y += 0.02;
            }
        }
    };

    const updateAnimations = (delta) => {
        mixers.forEach(m => m.update(delta));

        // Player State Machine
        for (const [id, animData] of playerAnimations) {
            let entity = null;
            if (player.value && player.value.id === id) entity = player.value;
            else entity = mapPlayers.value.find(p => p.id === id);

            if (!entity) continue;
            const mesh = meshes.get(id);
            if (!mesh) continue;

            const { actions, currentAction } = animData;
            let desired = actions.idle;
            const state = (entity.state || 'IDLE').toUpperCase();
            const isMoving = mesh.userData.isMoving;
            const speed = mesh.userData.speed;

            if (state === 'COMBAT' && actions.attack) {
                if (speed > 0.5) desired = actions.run;
                else desired = actions.attack;
            } else if ((state === 'MOVING' || isMoving) && actions.run) {
                desired = actions.run;
            }

            if (desired && desired !== currentAction) {
                if (desired === actions.attack) desired.reset();
                if (currentAction) currentAction.fadeOut(0.2);
                desired.reset().fadeIn(0.2).play();
                animData.currentAction = desired;
            }
        }
    };

    // Watchers
    watch(mapPlayers, updateEntityLifecycle, { deep: true });
    watch(mapMonsters, updateEntityLifecycle, { deep: true });
    watch(() => player.value?.current_map_id, updateEntityLifecycle);
    // Local player re-bind
    watch(player, (newP) => {
        if (newP && meshes.has(newP.id)) {
            const mesh = meshes.get(newP.id);
            mesh.userData.entity = newP;
        }
    });

    return {
        meshes,
        updateEntityLifecycle,
        updateEntityPositions,
        updateAnimations,
        clock
    };
}
