
import { ref } from 'vue';
import { player, currentMapData, mapNpcs, isFreeFarming, addLog, selectedTargetId, selectedMapId, activeMission } from '../state.js';
import { api } from '../services/api.js';
import { startAutoFarm, stopAutoFarm } from '../services/autoFarm.js';

export function useGameInteractions(emit) {
    const canEnterPortal = ref(false);
    const pendingPortal = ref(null);
    const canInteractNpc = ref(false);
    const closestNpc = ref(null);
    const canGather = ref(false);
    const closestResource = ref(null);
    const isGathering = ref(false);
    const gatherProgress = ref(0);
    const resourceCooldowns = ref({});

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

        // 1. Start Gathering (Server)
        const duration = await api.startGathering(closestResource.value.id);

        if (!duration) {
            isGathering.value = false;
            return;
        }

        const totalTime = duration;
        const interval = 50;
        const step = (interval / totalTime) * 100;

        const timer = setInterval(async () => {
            gatherProgress.value += step;
            if (gatherProgress.value >= 100) {
                clearInterval(timer);
                isGathering.value = false;
                await api.gatherResource(closestResource.value.id);
            }
        }, interval);
    };

    const confirmPortal = async () => {
        if (pendingPortal.value) {
            const target = pendingPortal.value.targetMap || pendingPortal.value.target_map_id;
            const tx = pendingPortal.value.target_x !== undefined ? pendingPortal.value.target_x : pendingPortal.value.x;
            const ty = pendingPortal.value.target_y !== undefined ? pendingPortal.value.target_y : pendingPortal.value.y;

            if (target) {
                await api.movePlayer(target, tx, ty);
                canEnterPortal.value = false;
            }
        }
    };

    const interactNpc = () => {
        if (closestNpc.value && emit) {
            emit('interact-npc', closestNpc.value);
        }
    };

    const toggleAutoAttack = () => {
        if (isFreeFarming.value) {
            stopAutoFarm();
            addLog("Auto Attack Disabled", "text-red-400");
        } else {
            if (player.value) {
                selectedMapId.value = player.value.current_map_id;
            }
            selectedTargetId.value = null;

            isFreeFarming.value = true;
            addLog("Auto Attack Enabled", "text-green-400");
            startAutoFarm();
        }
    };

    return {
        canEnterPortal,
        pendingPortal,
        canInteractNpc,
        closestNpc,
        canGather,
        closestResource,
        isGathering,
        gatherProgress,
        resourceCooldowns,
        checkInteractions,
        startGathering,
        confirmPortal,
        interactNpc,
        toggleAutoAttack
    };
}
