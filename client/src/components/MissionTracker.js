import { ref, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, activeMission, missions } from '../state.js';
import { startMission, stopMission } from '../services/autoFarm.js';

export default {
    template: `
    <div class="absolute top-1/2 right-0 transform -translate-y-1/2 flex flex-col gap-2 pointer-events-auto pr-2">
        <!-- Active Mission Card -->
        <div v-if="activeMissionData" 
             class="relative bg-black/40 backdrop-blur-sm border-l-2 border-yellow-500 pl-3 pr-4 py-2 cursor-pointer hover:bg-black/60 transition-all w-64 group"
             @click="toggleMission(activeMissionData)">
            
            <!-- Header -->
            <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-bold text-yellow-500 bg-yellow-900/50 px-1 rounded border border-yellow-700/50">Main</span>
                <span class="text-xs font-bold text-white shadow-black drop-shadow-md truncate">{{ activeMissionData.title }}</span>
            </div>
            
            <!-- Description / Objective -->
            <div class="text-[11px] text-gray-200 leading-tight mb-1 drop-shadow-md">
                {{ activeMissionData.description }}
            </div>
            
            <!-- Progress -->
            <div class="flex justify-end text-[11px] font-mono text-yellow-400 font-bold">
                ({{ currentProgress }}/{{ activeMissionData.target_count }})
            </div>

            <!-- Status Indicator -->
             <div class="absolute right-2 top-2 w-2 h-2 rounded-full" 
                  :class="isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'"></div>
            
             <!-- Tooltip/Hint on Hover -->
             <div class="hidden group-hover:block absolute right-full mr-2 top-0 bg-black/80 text-xs text-white p-2 rounded w-48 z-50">
                Click to {{ isActive ? 'Pause' : 'Start' }} Auto-Quest
             </div>
        </div>

        <!-- Available Missions List (Collapsed) -->
        <div v-else class="flex flex-col gap-1 items-end">
            <div v-for="mission in availableMissions" :key="mission.id"
                 class="bg-black/40 backdrop-blur-sm border-l-2 border-gray-500 pl-2 pr-3 py-1 cursor-pointer hover:bg-black/60 transition-all w-56 flex justify-between items-center"
                 @click="toggleMission(mission)">
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-gray-300">{{ mission.title }}</span>
                    <span class="text-[9px] text-gray-400">Lv. {{ mission.level_requirement }}</span>
                </div>
                <span class="text-[10px] text-gray-500">Click to Start</span>
            </div>
             <div v-if="availableMissions.length === 0" class="text-xs text-gray-500 bg-black/20 p-2 rounded">
                No active missions
            </div>
        </div>
    </div>
    `,
    setup() {
        const activeMissionData = computed(() => {
            if (!player.value?.active_mission_id) return null;
            return missions.value[player.value.active_mission_id];
        });

        const availableMissions = computed(() => {
            return Object.values(missions.value).filter(m => m.id !== player.value?.active_mission_id);
        });

        const currentProgress = computed(() => {
            return player.value?.mission_progress || 0;
        });

        const isActive = computed(() => {
            return activeMission.value && activeMission.value.id === player.value?.active_mission_id;
        });

        const toggleMission = (mission) => {
            if (player.value.level < mission.level_requirement) {
                alert(`Level ${mission.level_requirement} required!`);
                return;
            }

            if (isActive.value && activeMission.value.id === mission.id) {
                // Pause
                stopMission();
            } else {
                // Start/Resume
                startMission(mission);
            }
        };

        return {
            activeMissionData,
            availableMissions,
            currentProgress,
            isActive,
            toggleMission
        };
    }
};
