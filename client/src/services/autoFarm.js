
import { player, isFreeFarming, selectedMapId, selectedTargetId, selectedTargetType, mapMonsters, mapNpcs, addLog, pendingAttackId, destinationMarker, currentMapData, activeMission, missions, worldData, currentMonster } from '../state.js';
import { api } from './api.js';
import { pathfinder } from './Pathfinder.js';

let autoFarmInterval = null;

export const startAutoFarm = () => {
    if (autoFarmInterval) {
        clearInterval(autoFarmInterval);
    }
    addLog("Starting Auto-Farm Logic...", "text-gray-500");
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
    console.log(`[AutoFarm] Starting Mission: ${mission.title} (${mission.type}) Target: ${mission.target_template_id || mission.target_npc_id}`);

    // Notify Backend
    await api.startMission(mission.id);

    activeMission.value = mission;
    selectedMapId.value = mission.map_id;
    selectedTargetId.value = mission.target_template_id;

    // Start Auto-Farm loop for ALL mission types (including Talk/Delivery)
    startAutoFarm();
};

export const stopMission = (reason = "") => {
    stopAutoFarm();
    addLog(`Mission Paused. ${reason}`, "text-yellow-400");
    console.log(`[AutoFarm] Mission Paused: ${reason}`);
};

export const toggleFreeFarm = () => {
    if (isFreeFarming.value) {
        stopAutoFarm();
    } else {
        addLog("Starting Free Farm...", "text-green-400");
        isFreeFarming.value = true;
        activeMission.value = null;
        selectedTargetId.value = null; // Clear target to attack anything
        selectedTargetType.value = 'monster'; // Default to monster for free farm
        // Sync map preference to current location
        if (player.value) {
            selectedMapId.value = player.value.current_map_id;
        }
        startAutoFarm();
    }
};

let isProcessing = false;

export const checkAndAct = async () => {
    if (isProcessing) return;
    if (!player.value) return;

    isProcessing = true;
    try {
        // Failsafe: Ensure we are allowed to act
        if (!isFreeFarming.value && !activeMission.value) {
            return;
        }

        if (player.value.state === 'combat') {
            if (player.value.current_map_id !== selectedMapId.value) {
                addLog("Waiting for combat to end...", "text-yellow-500");
            }
            return;
        }

        // 1. Resolve Target Map
        let requiredMapId = selectedMapId.value;
        if (activeMission.value && activeMission.value.map_id) {
            requiredMapId = activeMission.value.map_id;
            selectedMapId.value = requiredMapId;
        }

        // LOG: Current Status
        // console.log(`[AutoFarm] Tick. Map: ${player.value.current_map_id} | Target Map: ${requiredMapId}`);

        // 2. Map Traversal (Pathfinding)
        if (player.value.current_map_id !== requiredMapId) {

            console.log(`[AutoFarm] Wrong Map. Finding path from ${player.value.current_map_id} to ${requiredMapId}...`);

            // Lazy load world data
            if (!pathfinder.worldData) await pathfinder.init();

            const path = pathfinder.findPath(player.value.current_map_id, requiredMapId);

            if (!path || path.length === 0) {
                // Fallback to old teleport if path fails (e.g. islands) or disconnected map
                const currentMapName = player.value.current_map_id;
                if (currentMapName !== requiredMapId) {
                    addLog(`No path found. Teleporting to ${requiredMapId}...`, "text-blue-400");
                    console.warn(`[AutoFarm] Pathfinding failed. Fallback teleport.`);
                    await api.movePlayer(requiredMapId, 50, 50);
                    await new Promise(r => setTimeout(r, 1000));
                }
                return;
            }

            const nextStep = path[0]; // { mapId, portal, targetMap }
            const portalId = nextStep.portal.id;

            // Find Portal in current map
            const portals = currentMapData.value?.portals || [];
            const portalDef = portals.find(p => p.id === portalId);

            if (!portalDef) {
                // Portal mismatch?
                addLog("Portal not found locally. Teleporting fallback...", "text-red-500");
                console.error(`[AutoFarm] Portal ${portalId} not found in map data.`);
                await api.movePlayer(requiredMapId, 50, 50);
                return;
            }

            // Move to Portal
            const dist = Math.sqrt((player.value.position.x - portalDef.x) ** 2 + (player.value.position.y - portalDef.y) ** 2);

            if (dist < 1.5) {
                addLog(`Using Portal to ${nextStep.targetMap}...`, "text-blue-400");
                console.log(`[AutoFarm] Entering portal to ${nextStep.targetMap}`);
                // Use Portal
                const tx = portalDef.target_x !== undefined ? portalDef.target_x : portalDef.x;
                const ty = portalDef.target_y !== undefined ? portalDef.target_y : portalDef.y;
                await api.movePlayer(nextStep.targetMap, tx, ty);

                // Pause for load
                // addLog("Loading map...", "text-gray-500");
                await new Promise(r => setTimeout(r, 2000));
                return;
            } else {
                // Walk to Portal
                console.log(`[AutoFarm] Moving to Portal at ${portalDef.x}, ${portalDef.y}`);
                destinationMarker.value = { x: portalDef.x, y: portalDef.y, isGameCoords: true };
                await api.movePlayer(player.value.current_map_id, portalDef.x, portalDef.y);
                return;
            }
        }

        // 3. Execute Mission on Target Map
        if (activeMission.value) {
            if (activeMission.value.type === 'talk' || activeMission.value.type === 'delivery') {
                await findAndInteractWithNPC();
            } else if (activeMission.value.target_source_type === 'resource') {
                await findAndGatherResource();
            } else {
                await findAndAttackTarget();
            }
        } else {
            // Free Farm (Combat only)
            await findAndAttackTarget();
        }

    } catch (e) {
        console.error("AutoFarm Error:", e);
    } finally {
        isProcessing = false;
    }
};

const findAndInteractWithNPC = async () => {
    if (!player.value) return;
    const targetNpcId = activeMission.value.target_npc_id;

    if (!targetNpcId) {
        addLog("Mission has no target NPC?", "text-red-500");
        return;
    }

    // console.log(`[AutoFarm] Looking for NPC: ${targetNpcId}`);

    // Check if NPC is in current map list
    // Ensure mapNpcs is populated (api.fetchMapNpcs is called on map load)
    const npc = mapNpcs.value.find(n => n.id === targetNpcId);

    if (npc) {
        const px = player.value.position.x;
        const py = player.value.position.y;
        const dist = Math.sqrt((px - npc.x) ** 2 + (py - npc.y) ** 2);

        if (dist > 2.0) {
            // Move to NPC
            // console.log(`[AutoFarm] Moving to NPC ${npc.name} at ${npc.x}, ${npc.y} (Dist: ${dist.toFixed(1)})`);
            // Determine if we are already moving to this spot? 
            // api.movePlayer sends command every tick if we call it, which might be spammy but ensures correction.
            // Ideally we check if destination is already set. For to keep it simple, we just call it.
            await api.movePlayer(player.value.current_map_id, npc.x, npc.y);
            destinationMarker.value = { x: npc.x, y: npc.y, isGameCoords: true };
        } else {
            // We are at the NPC
            // console.log(`[AutoFarm] Arrrived at NPC ${npc.name}.`);
            // Trigger "Talk" or just stop?
            // For now, stop moving and maybe show alert?
            if (destinationMarker.value) destinationMarker.value = null;

            // Optionally, Auto-Complete if API supports it or just notify user
            // addLog(`Arrived at ${npc.name}. Talk to them!`, "text-green-400");

            // If we want to simulate talking (not fully implemented in backend maybe?)
            // Just stop farming so user can click?
            // Actually user asked for "perfect auto walk".
            // Stopping at NPC is good.
            // We can check if mission is "Talk to Complete" or "Talk to Start"
            // But for now, just idling near them is the goal.

            // To prevent spamming "Arrived" logs or stop calls, check state
            // But we are in a loop.
            // Let's just return.
        }
    } else {
        console.warn(`[AutoFarm] NPC ${targetNpcId} NOT found in mapNpcs. Map: ${player.value.current_map_id}`);
        // Maybe we are on the wrong map and data is desynced?
        // Or NPC is missing from map data.
        addLog(`Cannot find NPC ${targetNpcId} here.`, "text-red-500");
    }
};

const findAndGatherResource = async () => {
    // console.log("Scanning for resources...");
    if (!player.value) return;
    if (player.value.state === 'combat') return;

    // Check resources in current map data
    const resources = currentMapData.value?.resources || [];
    if (resources.length === 0) return;

    const px = player.value.position.x;
    const py = player.value.position.y;
    const huntId = selectedTargetId.value;

    // Find nearest matching resource
    // Filter active cooldowns
    const activeCooldowns = currentMapData.value?.active_cooldowns || {};

    const target = resources
        .filter(r => {
            // Must match ID if specified
            if (huntId && r.template_id !== huntId && r.id !== huntId) return false;
            // Must not be on cooldown
            if (activeCooldowns[r.id]) return false;
            return true;
        })
        .sort((a, b) => {
            const distA = (a.x - px) ** 2 + (a.y - py) ** 2;
            const distB = (b.x - px) ** 2 + (b.y - py) ** 2;
            return distA - distB;
        })[0];

    if (target) {
        const dist = Math.sqrt((px - target.x) ** 2 + (py - target.y) ** 2);

        if (dist > 1.5) {
            // addLog(`Moving to ${target.name}...`, 'text-blue-300');
            console.log(`[AutoFarm] Moving to Resource ${target.name}`);
            api.movePlayer(player.value.current_map_id, target.x, target.y);
        } else {
            // Secure Gathering Flow
            // 1. Start Gathering (Server validation & determines duration)
            const duration = await api.startGathering(target.id);

            if (duration) {
                console.log(`[AutoFarm] Gathering ${target.name} for ${duration}ms...`);
                // Wait for the duration (plus small buffer)
                await new Promise(r => setTimeout(r, duration));

                // 2. Complete Gathering
                await api.gatherResource(target.id);
            }

            // Allow cooldown refresh
            await new Promise(r => setTimeout(r, 500));
        }
    } else {
        // No resource found?
        // addLog("Waiting for resource...", "text-gray-500");
    }
};

const findAndAttackTarget = async () => {
    // console.log("Scanning for targets...");
    if (!player.value) return;
    if (player.value.state === 'combat') return;

    await api.fetchMapMonsters(player.value.current_map_id);
    const monsters = mapMonsters.value;

    const px = player.value.position.x;
    const py = player.value.position.y;

    // Determine what we are hunting
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
            // console.log(`[AutoFarm] Moving to Monster ${target.name}`);
            api.movePlayer(player.value.current_map_id, target.position_x, target.position_y);
        } else {
            console.log(`[AutoFarm] Attacking ${target.name}`);
            api.attackMonster(target.id);
        }
    }
};
