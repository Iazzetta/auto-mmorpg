
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { player, currentMonster, destinationMarker, isFreeFarming, selectedTargetId, selectedMapId, pendingAttackId, isManuallyMoving, activeMission, addLog, mapMonsters } from '../state.js';
import { stopAutoFarm } from '../services/autoFarm.js';
import { api } from '../services/api.js';

export function useGameInput(scene, meshes, getCamera, getRenderer, container, interactions) {
    const keys = { w: false, a: false, s: false, d: false };
    let lastMoveTime = 0;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleKeyDown = (e) => {
        const tag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.key === 'w' || e.key === 'W') keys.w = true;
        if (e.key === 'a' || e.key === 'A') keys.a = true;
        if (e.key === 's' || e.key === 'S') keys.s = true;
        if (e.key === 'd' || e.key === 'D') keys.d = true;

        if (e.key === 'f' || e.key === 'F') {
            if (interactions.canEnterPortal.value) interactions.confirmPortal();
            else if (interactions.canInteractNpc.value) interactions.interactNpc();
            else if (interactions.canGather.value) interactions.startGathering();
        }
    };

    const handleKeyUp = (e) => {
        if (e.key === 'w' || e.key === 'W') keys.w = false;
        if (e.key === 'a' || e.key === 'A') keys.a = false;
        if (e.key === 's' || e.key === 'S') keys.s = false;
        if (e.key === 'd' || e.key === 'D') keys.d = false;
    };

    const onMouseClick = async (event) => {
        if (!player.value) return;
        const renderer = getRenderer();
        const camera = getCamera();
        if (!renderer || !camera || !container.value) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);

        for (let i = 0; i < intersects.length; i++) {
            const obj = intersects[i].object;

            if (obj.userData.type === 'monster') {
                const m = obj.userData.entity;
                if (m.hp > 0) {
                    addLog(`Moving to attack ${m.name}...`);
                    stopAutoFarm(false);
                    currentMonster.value = {
                        id: m.id,
                        name: m.name,
                        hp: m.stats.hp,
                        max_hp: m.stats.max_hp,
                        level: m.level
                    };
                    selectedTargetId.value = m.template_id;
                    selectedMapId.value = player.value.current_map_id;
                    isFreeFarming.value = false;

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

            // Check if clicked Ground (We don't explicitly have access to "groundPlane" variable here unless passed or found)
            // But usually ground is a mesh. The original code checked `obj === groundPlane`.
            // Here, we can check logic. If it's a large plane at y=0, effective enough? 
            // Or we check geometry type?
            // Better: Check if nothing else matched, and the object is NOT invalid?
            // Or simpler: Check if `obj.geometry instanceof THREE.PlaneGeometry`.

            // To be safe and exact to original code, we might want to pass groundPlane or identify it.
            // But let's check `obj.geometry.type === 'PlaneGeometry'` which is robust enough for now if no other planes.
            if (obj.geometry.type === 'PlaneGeometry') {
                const point = intersects[i].point;
                const gameX = point.x;
                const gameY = point.z;

                stopAutoFarm(false);
                currentMonster.value = null;
                destinationMarker.value = { x: gameX, y: gameY, time: Date.now(), isGameCoords: true };
                api.movePlayer(player.value.current_map_id, gameX, gameY);

                setTimeout(() => destinationMarker.value = null, 500);
                return;
            }
        }
    };

    const updateMovement = () => {
        if (!player.value) return;
        const now = Date.now();
        if (now - lastMoveTime < 100) return;

        let dx = 0;
        let dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        if (dx !== 0 || dy !== 0) {
            stopAutoFarm(false);
            isFreeFarming.value = false;
            currentMonster.value = null;
            isManuallyMoving.value = true;

            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;

            const dist = 5;
            const targetX = player.value.position.x + dx * dist;
            const targetY = player.value.position.y + dy * dist;

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
            if (isManuallyMoving.value) isManuallyMoving.value = false;

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

            if (player.value.state && player.value.state.toLowerCase() === 'moving') {
                player.value.state = 'idle';
                if (mesh) mesh.userData.isMoving = false;
                api.stopMovement();
                lastMoveTime = now;
            }
        }
    };

    onMounted(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        if (container.value) {
            container.value.addEventListener('click', onMouseClick);
        }
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        if (container.value) {
            container.value.removeEventListener('click', onMouseClick);
        }
    });

    return {
        updateMovement,
        keys // Export keys if needed elsewhere (GameMap needed it for local prediction check in updateEntityPositions)
    };
}
