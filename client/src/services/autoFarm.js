import { player, isFreeFarming, selectedMapId, selectedTargetId, mapMonsters, addLog, pendingAttackId, destinationMarker, currentMapData, activeMission, missions, worldData } from '../state.js';
import { api } from './api.js';

let autoFarmInterval = null;

export const startAutoFarm = () => {
    if (autoFarmInterval) clearInterval(autoFarmInterval);
    checkAndAct();
    autoFarmInterval = setInterval(checkAndAct, 1000);
};

export const stopAutoFarm = () => {
    if (autoFarmInterval) {
        clearInterval(autoFarmInterval);
        autoFarmInterval = null;
    }
    isFreeFarming.value = false;
    activeMission.value = null; // Clear active mission tracking
    pendingAttackId.value = null;
    destinationMarker.value = null;
};

export const startMission = (mission) => {
    stopAutoFarm(); // Stop current
    addLog(`Starting Mission: ${mission.title}`, "text-yellow-400");

    activeMission.value = mission;
    selectedMapId.value = mission.map_id;
    selectedTargetId.value = mission.target_template_id;

    // If mission is not active on server, set it (optional, if server tracks it)
    // For now, we assume server tracks via 'active_mission_id' which is set when we accept?
    // Or we just farm the requirements.
    // Let's assume we just farm.

    startAutoFarm();
};

export const stopMission = () => {
    stopAutoFarm();
    addLog("Mission Paused.", "text-yellow-400");
};

export const toggleFreeFarm = () => {
    if (isFreeFarming.value) {
        stopAutoFarm();
    } else {
        addLog("Starting Free Farm...", "text-green-400");
        isFreeFarming.value = true;
        activeMission.value = null;
        startAutoFarm();
    }
};

export const checkAndAct = async () => {
    if (!player.value) return;
    if (player.value.state === 'combat') return;
    if (player.value.state === 'moving') return;

    // 1. Check Map
    if (player.value.current_map_id !== selectedMapId.value) {

        // Teleport Logic (Fast Travel)
        const targetMap = worldData.value?.maps?.[selectedMapId.value];

        if (targetMap) {
            // Check Level Requirement
            if (player.value.level >= (targetMap.level_requirement || 0)) {
                addLog(`Teleporting to ${formatMapName(selectedMapId.value)}...`, "text-blue-400");

                // Use movePlayer to teleport (assuming backend allows it or we add a teleport endpoint)
                // For now, we'll try movePlayer to the respawn point of the target map.
                // If backend validates distance, this might fail. We should probably add a teleport endpoint.
                // But let's try this first as requested "teleport automatically".

                // Actually, let's use a specific teleport action if possible, or just move to spawn.
                await api.movePlayer(selectedMapId.value, targetMap.respawn_x || 50, targetMap.respawn_y || 50);

                // Wait a bit for server to process
                await new Promise(r => setTimeout(r, 500));
            } else {
                addLog(`Cannot enter ${targetMap.name}. Level ${targetMap.level_requirement} required.`, "text-red-500");
                stopMission();
                return;
            }
        } else {
            addLog(`Unknown map: ${selectedMapId.value}`, "text-red-400");
            stopMission();
            return;
        }

        await api.refreshPlayer();
        return;
    }

    // 2. Scan for Targets
    findAndAttackTarget();
};

const findAndAttackTarget = async () => {
    if (!player.value) return;
    if (player.value.state === 'combat') return;

    await api.fetchMapMonsters(player.value.current_map_id);
    const monsters = mapMonsters.value;

    const px = player.value.position.x;
    const py = player.value.position.y;

    const target = monsters
        .filter(m => shouldAttack(m))
        .sort((a, b) => {
            const distA = (a.position_x - px) ** 2 + (a.position_y - py) ** 2;
            const distB = (b.position_x - px) ** 2 + (b.position_y - py) ** 2;
            return distA - distB;
        })[0];

    if (target) {
        const mx = target.position_x;
        const my = target.position_y;
        const px = player.value.position.x;
        const py = player.value.position.y;
        const dist = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);

        if (dist > 2.0) {
            addLog(`Moving to ${target.name}...`, 'text-blue-300');
            const angle = Math.atan2(my - py, mx - px);
            const stopDist = 0;
            const tx = mx - Math.cos(angle) * stopDist;
            const ty = my - Math.sin(angle) * stopDist;

            destinationMarker.value = { x: tx, y: ty, time: Date.now(), isGameCoords: true };

            await api.movePlayer(player.value.current_map_id, tx, ty);
            pendingAttackId.value = target.id;
        } else {
            addLog(`Found ${target.name}! Engaging...`, 'text-red-400');
            // Optimistic update to prevent move spam
            if (player.value) player.value.state = 'combat';
            api.attackMonster(target.id);
        }
    } else {
        // No target found on map
        if (activeMission.value) {
            addLog("Searching for targets...", "text-gray-400");
            // Maybe move randomly to find spawns?
            // For now, just wait.
        }
    }
};

const shouldAttack = (monster) => {
    if (!selectedTargetId.value) return true;
    return monster.template_id === selectedTargetId.value;
};

const formatMapName = (id) => {
    if (!id) return '';
    return id.replace('map_', '').replace('_', ' ').toUpperCase();
};
const findPath = (startId, endId, maps) => {
    const queue = [[startId]];
    const visited = new Set();
    visited.add(startId);

    while (queue.length > 0) {
        const path = queue.shift();
        const currentId = path[path.length - 1];

        if (currentId === endId) return path;

        const map = maps[currentId];
        if (map && map.portals) {
            for (const portal of map.portals) {
                if (!visited.has(portal.target_map_id) && maps[portal.target_map_id]) {
                    visited.add(portal.target_map_id);
                    const newPath = [...path, portal.target_map_id];
                    queue.push(newPath);
                }
            }
        }
    }
    return null;
};
