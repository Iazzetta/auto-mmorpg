import { player, isFreeFarming, selectedMapId, selectedTargetId, mapMonsters, addLog, pendingAttackId, destinationMarker, currentMapData } from '../state.js';
import { api } from './api.js';

let autoFarmInterval = null;

export const startAutoFarm = () => {
    if (autoFarmInterval) clearInterval(autoFarmInterval);
    checkAndAct();
    autoFarmInterval = setInterval(checkAndAct, 4000);
};

export const stopAutoFarm = () => {
    if (autoFarmInterval) {
        clearInterval(autoFarmInterval);
        autoFarmInterval = null;
    }
    isFreeFarming.value = false;
    pendingAttackId.value = null;
    destinationMarker.value = null;
};

export const toggleFreeFarm = () => {
    if (isFreeFarming.value) {
        stopAutoFarm();
    } else {
        addLog("Starting Free Farm...", "text-green-400");
        isFreeFarming.value = true;
        startAutoFarm();
    }
};

export const checkAndAct = async () => {
    if (!player.value) return;
    if (player.value.state === 'combat') return;
    if (player.value.state === 'moving') return;

    // 1. Check Map
    if (player.value.current_map_id !== selectedMapId.value) {
        addLog(`Moving to ${formatMapName(selectedMapId.value)}...`);

        // Find portal to target map
        let targetPortal = null;
        if (currentMapData.value && currentMapData.value.portals) {
            targetPortal = currentMapData.value.portals.find(p => p.target_map_id === selectedMapId.value);
        }

        if (targetPortal) {
            const dist = Math.sqrt((player.value.position.x - targetPortal.x) ** 2 + (player.value.position.y - targetPortal.y) ** 2);
            if (dist < 3.0) {
                // Enter portal
                await api.movePlayer(targetPortal.target_map_id, targetPortal.target_x, targetPortal.target_y);
            } else {
                // Move to portal
                await api.movePlayer(player.value.current_map_id, targetPortal.x, targetPortal.y);
            }
        } else {
            // Fallback: Move to center if no direct portal (simple fallback)
            await api.movePlayer(player.value.current_map_id, 50, 50);
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

        if (dist > 1.0) {
            addLog(`Moving to ${target.name}...`, 'text-blue-300');
            const angle = Math.atan2(my - py, mx - px);
            const stopDist = 0;
            const tx = mx - Math.cos(angle) * stopDist;
            const ty = my - Math.sin(angle) * stopDist;

            // Visual marker (need access to canvas dimensions? No, just raw game coords for now, component handles visual)
            // Wait, destinationMarker needs canvas coords in the old code. 
            // We should change destinationMarker to store GAME coords and let the component translate.
            destinationMarker.value = { x: tx, y: ty, time: Date.now(), isGameCoords: true };

            await api.movePlayer(player.value.current_map_id, tx, ty);
            pendingAttackId.value = target.id;
        } else {
            addLog(`Found ${target.name}! Engaging...`, 'text-red-400');
            api.attackMonster(target.id);
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
