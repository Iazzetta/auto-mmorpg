import { ref, computed, watch } from 'vue';
import { player, activeMission, missions, mapNpcs, selectedTargetId, selectedTargetType } from '../state.js';
import { startMission, stopMission } from '../services/autoFarm.js';
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
        </div>
    `,
    setup() {
        const showOverlay = ref(false);
        const completingId = ref(null);
        const newMissionId = ref(null);

        // Watch for Active Mission changing to something valid
        watch(() => player.value?.active_mission_id, (newId, oldId) => {
            if (newId && newId !== oldId) {
                newMissionId.value = newId;
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

            if (mission.newlyAdded) return 'border-4 border-yellow-400 shadow-[0_0_20px_gold] bg-yellow-900/80';
            if (isLocked(mission)) return 'border-red-600 bg-red-900/40 opacity-70 grayscale cursor-not-allowed';
            if (mission.is_main_quest) return 'border-yellow-500 bg-yellow-900/40 shadow-lg shadow-yellow-900/20';
            if (isCompleted(mission)) return 'border-green-500 bg-green-900/20';
            if (isActive(mission)) return 'border-blue-500 bg-blue-900/20';
            return 'border-gray-600 hover:border-gray-400';
        };


        const handleMissionClick = (mission) => {
            if (isLocked(mission)) return;
            if (isCompleted(mission)) return;

            // Simplified: All missions (talk, delivery, combat, gather) are handled by autoFarm service
            startMission(mission);
        };

        const claimReward = async () => {
            const mission = allMissions.value.find(m => isCompleted(m) && isActive(m));
            if (!mission) return;

            completingId.value = mission.id;

            try {
                // stopMission("Mission Completed"); // Optional: Stop farm while claiming
                await api.claimMission(mission.id);
                stopMission("Mission Completed");
            } catch (e) {
                console.error(e);
                completingId.value = null;
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
            completingId,
            showOverlay
        };
    }
};
