import { ref, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, activeMission, missions } from '../state.js';
import { startMission, stopMission } from '../services/autoFarm.js';

export default {
    template: `
    <div class="absolute top-32 right-4 w-64 flex flex-col gap-2 pointer-events-auto">
        <!-- Active Mission Card -->
        <div v-if="activeMissionData" 
             class="bg-gray-900/90 border-l-4 border-yellow-500 p-3 rounded shadow-lg cursor-pointer hover:bg-gray-800 transition-colors"
             @click="toggleMission(activeMissionData)">
            <div class="flex justify-between items-start mb-1">
                <h3 class="font-bold text-yellow-500 text-sm">{{ activeMissionData.title }}</h3>
                <span class="text-[10px] bg-gray-700 px-1 rounded text-gray-300">Lv. {{ activeMissionData.level_requirement }}</span>
            </div>
            <p class="text-xs text-gray-400 mb-2">{{ activeMissionData.description }}</p>
            
            <!-- Progress -->
            <div class="flex justify-between text-xs text-gray-300 mb-1">
                <span>Progress</span>
                <span>{{ currentProgress }} / {{ activeMissionData.target_count }}</span>
            </div>
            <div class="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div class="bg-yellow-500 h-full transition-all duration-500" 
                     :style="{ width: (currentProgress / activeMissionData.target_count * 100) + '%' }"></div>
            </div>
            
            <div class="mt-2 text-[10px] text-green-400 font-mono" v-if="isActive">
                <span class="animate-pulse">▶ Auto-Executing...</span>
            </div>
            <div class="mt-2 text-[10px] text-gray-500 font-mono" v-else>
                <span>Click to Resume</span>
            </div>
        </div>

        <!-- Available Missions List -->
        <div class="flex flex-col gap-1 mt-2">
            <div v-for="mission in availableMissions" :key="mission.id"
                 class="bg-gray-900/80 border-l-4 border-gray-600 p-2 rounded shadow cursor-pointer hover:bg-gray-800 hover:border-blue-500 transition-all"
                 @click="toggleMission(mission)">
                <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-gray-300">{{ mission.title }}</span>
                    <span class="text-[10px] text-gray-500">Lv. {{ mission.level_requirement }}</span>
                </div>
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
