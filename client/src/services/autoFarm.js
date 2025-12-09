import { player, isFreeFarming, selectedMapId, selectedTargetId, mapMonsters, addLog, pendingAttackId, destinationMarker, currentMapData, activeMission, missions, worldData, currentMonster } from '../state.js';
import { api } from './api.js';

let autoFarmInterval = null;

export const startAutoFarm = () => {
    if (autoFarmInterval) {
        clearInterval(autoFarmInterval);
    }
    checkAndAct();
    autoFarmInterval = setInterval(checkAndAct, 1000);
};

export const stopAutoFarm = (stopServer = true) => {
    if (autoFarmInterval) {
        clearInterval(autoFarmInterval);
        autoFarmInterval = null;
    }
    isFreeFarming.value = false;
    currentMonster.value = null; // Clear UI
    activeMission.value = null; // Clear active mission tracking
    pendingAttackId.value = null;
    destinationMarker.value = null;

    if (stopServer) {
        api.stopMovement();
    }

    if (player.value) player.value.state = 'idle';
};

export const startMission = async (mission) => {
    stopAutoFarm(); // Stop current
    addLog(`Starting Mission: ${mission.title}`, "text-yellow-400");

    // Notify Backend
    await api.startMission(mission.id);

    activeMission.value = mission;
    selectedMapId.value = mission.map_id;
    selectedTargetId.value = mission.target_template_id;

    startAutoFarm();
};

export const stopMission = (reason = "") => {
    stopAutoFarm();
    addLog(`Mission Paused. ${reason}`, "text-yellow-400");
};

export const toggleFreeFarm = () => {
    if (isFreeFarming.value) {
        stopAutoFarm();
    } else {
        addLog("Starting Free Farm...", "text-green-400");
        isFreeFarming.value = true;
        activeMission.value = null;
        // Sync map preference to current location
        if (player.value) {
            selectedMapId.value = player.value.current_map_id;
        }
        startAutoFarm();
    }
};

export const checkAndAct = async () => {
    // console.log("checkAndAct Tick");
    if (!player.value) return;
    // Failsafe: Ensure we are allowed to act
    if (!isFreeFarming.value && !activeMission.value) {
        return;
    }

    if (player.value.state === 'combat') {
        // console.log("checkAndAct: Player in combat stay.");
        if (player.value.current_map_id !== selectedMapId.value) {
            addLog("Waiting for combat to end before teleporting...", "text-yellow-500");
        }
        return;
    }

    // 1. Check Map
    if (player.value.current_map_id !== selectedMapId.value) {

        const targetMap = worldData.value?.maps?.[selectedMapId.value];

        if (targetMap) {
            // Check Level Requirement
            if (player.value.level >= (targetMap.level_requirement || 0)) {
                addLog(`Teleporting to ${formatMapName(selectedMapId.value)}...`, "text-blue-400");

                await api.movePlayer(selectedMapId.value, targetMap.respawn_x || 50, targetMap.respawn_y || 50);

                // Wait a bit for server to process
                await new Promise(r => setTimeout(r, 500));
                await api.refreshPlayer();

                if (!isFreeFarming.value && !activeMission.value) return; // Check call after await

                // If map changed successfully, continue to scan immediately
                if (player.value.current_map_id !== selectedMapId.value) {
                    addLog("Waiting for map transition...", "text-yellow-400");
                    return;
                }
                addLog("Arrived. Scanning targets...", "text-green-400");

            } else {
                addLog(`Cannot enter ${targetMap.name}. Level ${targetMap.level_requirement} required.`, "text-red-500");
                stopMission();
                return;
            }
        } else {
            // Try to fetch world data if missing map
            try {
                const res = await fetch('http://localhost:8000/editor/world');
                if (res.ok) {
                    worldData.value = await res.json();
                    // Retry next tick
                    return;
                }
            } catch (e) { }

            addLog(`Unknown map: ${selectedMapId.value}`, "text-red-400");
            stopMission();
            return;
        }
    }

    // 2. Scan for Targets
    findAndAttackTarget();
};

const findAndAttackTarget = async () => {
    console.log("Scanning for targets...");
    if (!player.value) return;
    if (player.value.state === 'combat') return;

    await api.fetchMapMonsters(player.value.current_map_id);
    const monsters = mapMonsters.value;

    const px = player.value.position.x;
    const py = player.value.position.y;

    // Determine what we are hunting
    // If active mission has a specific target monster (e.g. for collection), use it.
    let huntId = selectedTargetId.value;

    if (activeMission.value && activeMission.value.target_monster_id) {
        huntId = activeMission.value.target_monster_id;
    }

    let target = null;

    // Prioritize pending target if valid and alive
    if (pendingAttackId.value) {
        target = monsters.find(m => m.id === pendingAttackId.value);
        if (!target) pendingAttackId.value = null;
    }

    if (!target) {
        target = monsters
            .filter(m => !huntId || m.template_id === huntId)
            .sort((a, b) => {
                const distA = (a.position_x - px) ** 2 + (a.position_y - py) ** 2;
                const distB = (b.position_x - px) ** 2 + (b.position_y - py) ** 2;
                return distA - distB;
            })[0];
    }

    if (target) {
        const mx = target.position_x;
        const my = target.position_y;
        const dist = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);

        if (dist > 1.5) {
            // addLog(`Moving to ${target.name}...`, 'text-blue-300');
            api.movePlayer(player.value.current_map_id, target.position_x, target.position_y);
        } else {
            api.attackMonster(target.id);
        }
    }
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
