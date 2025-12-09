import { ref, computed, watch } from 'vue';
import { player, activeMission, missions, mapNpcs, showToast, selectedTargetId } from '../state.js';
import { startMission, stopMission, startAutoFarm } from '../services/autoFarm.js';
import { api } from '../services/api.js';

export default {
    template: `
    <div class="absolute top-1/2 right-0 transform -translate-y-1/2 flex flex-col gap-2 pointer-events-auto pr-2 max-h-[80vh] overflow-y-auto z-40">
        
        <div v-for="mission in allMissions" :key="mission.id"
             class="relative bg-black/40 backdrop-blur-sm border-l-4 pl-3 pr-4 py-2 cursor-pointer hover:bg-black/60 transition-all w-64 group"
             :class="getMissionClass(mission)"
             @click="handleMissionClick(mission)">
            
            <!-- Header -->
            <div class="flex items-center gap-2 mb-1">
                <span v-if="mission.newlyAdded" class="text-xs bg-yellow-500 text-black px-1 rounded font-bold animate-pulse absolute -left-2 -top-2 z-10 shadow-lg shadow-yellow-500/50">NEW!</span>
                <span v-if="mission.is_main_quest" class="text-yellow-400 text-sm animate-pulse">★</span>
                <span v-if="isCompleted(mission)" class="text-[10px] font-bold text-green-500 bg-green-900/50 px-1 rounded border border-green-700/50">Done</span>
                <span class="text-xs font-bold text-white shadow-black drop-shadow-md truncate flex-1">{{ mission.title }}</span>
            </div>
            
            <!-- Description / Objective -->
            <div class="text-[11px] text-gray-200 leading-tight mb-1 drop-shadow-md">
                {{ mission.description }}
            </div>
            
            <!-- Progress -->
            <div class="flex justify-between items-center mt-2">
                 <span class="text-[10px] text-gray-400">Lv. {{ mission.level_requirement }}</span>
                 <div class="text-[11px] font-mono font-bold" :class="isCompleted(mission) ? 'text-green-400' : 'text-yellow-400'">
                    <span v-if="isTalkOrDelivery(mission) && isActive(mission)">
                        <span v-if="isCompleted(mission)">Talk to Complete</span>
                        <span v-else-if="mission.type === 'delivery'">
                            <template v-if="getDeliveryStatus(mission)">
                                <span v-if="getDeliveryStatus(mission).ready" class="text-green-400 font-bold">Deliver to NPC</span>
                                <span v-else class="text-yellow-400">{{ getDeliveryStatus(mission).text }} ({{ getDeliveryStatus(mission).count }})</span>
                            </template>
                        </span>
                        <span v-else>Go to NPC</span>
                    </span>
                    <span v-else-if="isActive(mission) || isCompleted(mission)">
                        ({{ getProgress(mission) }}/{{ mission.target_count }})
                    </span>
                    <span v-else-if="isTalkOrDelivery(mission)">
                        (Talk to Start)
                    </span>
                    <span v-else>
                        (0/{{ mission.target_count }})
                    </span>
                </div>
            </div>

            <!-- Status Indicator (Green Dot) -->
             <div v-if="isActive(mission) && !isCompleted(mission)" 
                  class="absolute right-2 top-2 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>

            <!-- Claim Button Overlay -->
            <div v-if="isCompleted(mission) && isActive(mission)" class="mt-2">
                <button @click.stop="claimReward" class="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1 rounded animate-pulse">
                    CLAIM REWARD
                </button>
            </div>
        </div>
            <!-- Mission Complete Overlay -->
            <transition name="fade">
                <div v-if="showOverlay" class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div class="bg-black/80 backdrop-blur-md border-4 border-yellow-500 rounded-lg p-8 transform scale-100 animate-bounce-in text-center shadow-[0_0_50px_rgba(234,179,8,0.5)]">
                        <div class="text-6xl mb-4">🏆</div>
                        <h2 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 drop-shadow-sm uppercase tracking-wider">
                            Mission Complete!
                        </h2>
                        <div class="text-yellow-200 mt-2 font-mono text-lg font-bold">Rewards Claimed</div>
                    </div>
                </div>
            </transition>
        </div>
    `,
    setup() {
        const showOverlay = ref(false);
        const completingId = ref(null);
        const newMissionId = ref(null); // Track new mission for entrance animation

        // Watch for Active Mission changing to something valid
        watch(() => player.value?.active_mission_id, (newId, oldId) => {
            if (newId && newId !== oldId) {
                newMissionId.value = newId;
                // Clear animation faster (1.5s)
                setTimeout(() => {
                    if (newMissionId.value === newId) {
                        newMissionId.value = null;
                    }
                }, 1500);
            }
        }, { immediate: true });


        const allMissions = computed(() => {
            const completed = player.value?.completed_missions || [];
            const activeId = player.value?.active_mission_id;
            const activeMission = activeId ? missions.value[activeId] : null;
            const hasActiveMainQuest = activeMission?.is_main_quest;

            let available = Object.values(missions.value)
                .filter(m => !completed.includes(m.id));

            // Separate Main and Side
            const mainQuests = available.filter(m => m.is_main_quest);
            const sideQuests = available.filter(m => !m.is_main_quest && (m.source !== 'npc' || isActive(m)));

            // Main Quest Logic: Show Active OR First Available
            let visibleMainQuests = [];
            if (hasActiveMainQuest) {
                // If active, show ONLY the active one (even if others are available on board)
                visibleMainQuests = mainQuests.filter(m => m.id === activeId);
            } else {
                // If none active, show the first available (lowest level/ID)
                // Assuming sequential progression, show only one.
                if (mainQuests.length > 0) {
                    mainQuests.sort((a, b) => a.level_requirement - b.level_requirement);
                    visibleMainQuests = [mainQuests[0]];
                }
            }

            // Combine
            const list = [...visibleMainQuests, ...sideQuests].sort((a, b) => {
                if (a.is_main_quest && !b.is_main_quest) return -1;
                if (!a.is_main_quest && b.is_main_quest) return 1;
                return a.level_requirement - b.level_requirement;
            });

            // Inject 'newlyAdded' flag for template if matches
            return list.map(m => ({
                ...m,
                newlyAdded: m.id === newMissionId.value
            }));
        });

        const isActive = (mission) => {
            return player.value?.active_mission_id === mission.id;
        };

        const isCompleted = (mission) => {
            if (!isActive(mission)) return false;
            return (player.value?.mission_progress || 0) >= mission.target_count;
        };

        const isLocked = (mission) => {
            return (player.value?.level || 1) < mission.level_requirement;
        };

        const getProgress = (mission) => {
            if (isActive(mission)) return player.value?.mission_progress || 0;
            return 0;
        };

        const isTalkOrDelivery = (mission) => {
            return mission.type === 'talk' || mission.type === 'delivery';
        };

        const getDeliveryStatus = (mission) => {
            if (mission.type !== 'delivery') return null;
            const requiredItem = mission.target_item_id;
            const requiredQty = mission.target_count || 1;
            const inv = player.value?.inventory || [];

            // Debug Log to catch Item ID issues
            console.log(`[MissionTracker] Checking '${requiredItem}' in Inv: `, inv.map(i => i.id));

            const hasItem = inv.find(i => i.id === requiredItem || i.id.startsWith(requiredItem));
            const currentQty = hasItem ? (hasItem.quantity || 1) : 0;

            if (currentQty < requiredQty) {
                const itemName = requiredItem.replace('item_', '').replace('mat_', '').replace(/_/g, ' ');
                return { text: `Gather ${itemName} `, count: `${currentQty}/${requiredQty}`, ready: false };
            }
            return { text: "Deliver", count: null, ready: true };
        };

        const getMissionClass = (mission) => {
            if (mission.id === completingId.value) return 'scale-90 opacity-0 transition-all duration-500 bg-yellow-400/50';

            // Entrance Animation (High Priority)
            if (mission.newlyAdded) return 'border-4 border-yellow-400 shadow-[0_0_20px_gold] bg-yellow-900/80';

            if (isLocked(mission)) return 'border-red-600 bg-red-900/40 opacity-70 grayscale cursor-not-allowed';

            if (mission.is_main_quest) return 'border-yellow-500 bg-yellow-900/40 shadow-lg shadow-yellow-900/20'; // Main Quest Style

            if (isCompleted(mission)) return 'border-green-500 bg-green-900/20';
            if (isActive(mission)) return 'border-blue-500 bg-blue-900/20';
            return 'border-gray-600 hover:border-gray-400';
        };


        const handleMissionClick = (mission) => {
            if (isLocked(mission)) return;
            if (isCompleted(mission)) return;

            // Auto-Walk for NPC Missions
            if (isTalkOrDelivery(mission)) {
                // Set as active first (this stops previous actions/movement via stopAutoFarm)
                if (!isActive(mission) && mission.source === 'board') {
                    startMission(mission);
                }

                // Delivery Logic Check
                if (mission.type === 'delivery') {
                    const requiredItem = mission.target_item_id;
                    const requiredQty = mission.target_count || 1;

                    // Check Inventory
                    const inv = player.value.inventory || [];
                    const hasItem = inv.find(i => i.id === requiredItem || i.id.startsWith(requiredItem));
                    const currentQty = hasItem ? (hasItem.quantity || 1) : 0;

                    if (currentQty < requiredQty) {
                        // Phase 1: Go Gather
                        // Check if we are on the source map
                        if (mission.map_id && mission.map_id !== player.value.current_map_id) {
                            showToast('🌲', 'Go Gather', `Go to ${mission.map_id} to find items.`, 'text-blue-400');
                            // Move to Portal/Map logic? Or just tell user?
                            // Ideally, auto-walk to portal if possible, for now just Toast + Move if user has map coords?
                            // Actually, just telling them to go there is better than trying to pathfind across maps safely without complex logic.
                            // BUT user asked for "perfect auto walk".
                            // If we have map portals data, we could find portal to target map. 
                            // For now, let's at least NOT try to walk to the NPC who is in another map.
                            return;
                        } else {
                            // On source map: Tell them to farm

                            // AUTO-FARM LOGIC FOR DELIVERY
                            if (mission.target_source_type === 'monster' && mission.target_source_id) {
                                selectedTargetId.value = mission.target_source_id;
                                startAutoFarm();
                                showToast('⚔️', 'Auto Hunt', `Hunting for ${requiredItem}...`, 'text-red-400');
                                return;
                            } else if (mission.target_source_type === 'resource') {
                                // Placeholder for resource auto-gather
                                showToast('🪓', 'Gather Time', `Find ${requiredItem} from resources!`, 'text-green-400');
                                return;
                            }

                            showToast('🪓', 'Gather Time', `Find ${requiredItem} here!`, 'text-green-400');
                            // Maybe verify if we can target a resource?
                            return;
                        }
                    }
                }

                // Phase 2: Go to NPC (Talk or Delivery Ready)
                if (!mission.target_npc_id) {
                    showToast('❌', 'Error', 'Mission has no target NPC.', 'text-red-400');
                    return;
                }

                // Find NPC
                // First check current map NPCs
                const targetNpc = mapNpcs.value.find(n => n.id === mission.target_npc_id);

                if (targetNpc) {
                    // Slight delay to ensure stopMovement passed
                    setTimeout(() => {
                        api.movePlayer(player.value.current_map_id, targetNpc.x, targetNpc.y);
                        showToast('🚶', 'Moving', `Walking to ${targetNpc.name}...`, 'text-blue-400');
                    }, 100);
                } else {
                    // Check if NPC is on another map (Destination Map usually Castle for quests)
                    // Config might not have target_map_id for NPC, usually standard is Castle for guides.
                    // If we can't find NPC, warn user.
                    showToast('❓', 'Where is he?', `Cannot find NPC ${mission.target_npc_id} here.`, 'text-red-400');
                }
                return;
            }

            // Kill/Collect -> Auto Farm
            startMission(mission);
        };



        // ... (existing computed/functions)

        const claimReward = async () => {
            const activeId = player.value?.active_mission_id;
            if (activeId) {
                // Animation Start
                completingId.value = activeId;

                // Trigger Overlay Delay
                showOverlay.value = true;
                setTimeout(() => {
                    showOverlay.value = false;
                }, 3000);

                // Wait for Card Animation (e.g. 500ms)
                setTimeout(async () => {
                    const success = await api.claimMission();
                    if (success) {
                        stopMission();
                    }
                    completingId.value = null; // Reset
                }, 600);
            }
        };

        return {
            allMissions,
            isActive,
            isCompleted,
            isLocked,
            getProgress,
            getMissionClass,
            handleMissionClick,
            claimReward,
            isTalkOrDelivery,
            getDeliveryStatus,
            showOverlay,
            completingId
        };
    }
};
