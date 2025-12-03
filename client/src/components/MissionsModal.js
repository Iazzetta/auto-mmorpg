import { ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, availableMissions, addLog } from '../state.js';
import { api } from '../services/api.js';
import { startAutoFarm, stopAutoFarm } from '../services/autoFarm.js';
import { selectedMapId, selectedTargetId } from '../state.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" @click.self="$emit('close')">
            <div class="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-2xl h-[500px] flex flex-col">
                <h2 class="text-2xl font-bold text-white mb-4 border-b border-gray-600 pb-2">Missions</h2>
                
                <div class="flex-1 overflow-y-auto space-y-2">
                    <div v-for="(mission, id) in availableMissions" :key="id"
                        class="p-4 rounded border transition-colors cursor-pointer"
                        :class="getMissionClass(id)" @click="selectMission(id)">
                        
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h3 class="font-bold text-lg">{{ mission.title }}</h3>
                                <p class="text-sm text-gray-400">{{ mission.description }}</p>
                            </div>
                            <div class="text-right">
                                <div v-if="isMissionCompleted(id)" class="text-green-500 font-bold">✓ Completed</div>
                                <div v-else-if="player.active_mission_id === id" class="text-blue-400 font-bold">▶ Active</div>
                                <div class="text-xs text-yellow-200 mt-1">Reward: {{ mission.reward_xp }} XP, {{ mission.reward_gold }} G</div>
                            </div>
                        </div>

                        <!-- Progress Bar -->
                        <div class="w-full bg-gray-900 rounded-full h-3 mb-2">
                            <div class="bg-blue-500 h-3 rounded-full transition-all"
                                :style="{ width: getMissionProgressPercent(id) + '%' }"></div>
                        </div>
                        <div class="flex justify-between text-xs text-gray-500">
                            <span>Progress: {{ getMissionProgress(id) }} / {{ mission.target_count }}</span>
                            <span>{{ Math.round(getMissionProgressPercent(id)) }}%</span>
                        </div>

                        <!-- Actions -->
                        <div class="mt-3 flex justify-end gap-2">
                            <button v-if="canClaim(id)" @click.stop="claimMission"
                                class="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-4 rounded animate-pulse">
                                Claim Reward
                            </button>
                            <button v-if="player.active_mission_id !== id && !isMissionCompleted(id)" @click.stop="startMission(id)"
                                class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-4 rounded">
                                Start Mission
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const fetchMissions = async () => {
            const res = await fetch(`http://localhost:8000/content/missions`);
            availableMissions.value = await res.json();
        };

        onMounted(() => {
            fetchMissions();
        });

        const getMissionClass = (id) => {
            if (isMissionCompleted(id)) return 'bg-gray-900 border-gray-700 opacity-60';
            if (player.value && player.value.active_mission_id === id) return 'bg-gray-700 border-blue-500 shadow-md';
            return 'bg-gray-700 border-transparent hover:border-gray-500 hover:bg-gray-600';
        };

        const selectMission = (id) => {
            // Just highlight or expand details if needed
        };

        const isMissionCompleted = (id) => {
            return player.value && player.value.completed_missions.includes(id);
        };

        const getMissionProgress = (id) => {
            if (!player.value) return 0;
            if (player.value.active_mission_id === id) return player.value.mission_progress;
            if (isMissionCompleted(id)) return availableMissions.value[id]?.target_count || 0;
            return 0;
        };

        const getMissionProgressPercent = (id) => {
            if (!player.value) return 0;
            const target = availableMissions.value[id]?.target_count || 1;
            let current = 0;
            if (player.value.active_mission_id === id) {
                current = player.value.mission_progress;
            } else if (isMissionCompleted(id)) {
                current = target;
            }
            return Math.min(100, (current / target) * 100);
        };

        const canClaim = (id) => {
            if (!player.value || player.value.active_mission_id !== id) return false;
            const target = availableMissions.value[id]?.target_count || 1;
            return player.value.mission_progress >= target;
        };

        const startMission = async (missionId) => {
            if (!player.value) return;
            stopAutoFarm();

            try {
                const res = await fetch(`http://localhost:8000/player/${player.value.id}/mission/start?mission_id=${missionId}`, { method: 'POST' });
                if (!res.ok) throw new Error("Failed to start mission");

                const data = await res.json();
                addLog(`Mission Started: ${data.mission.title}`, 'text-green-400');
                await api.refreshPlayer();

                const mission = availableMissions.value[missionId];
                selectedMapId.value = mission.map_id;
                selectedTargetId.value = mission.target_monster_id;

                startAutoFarm();
            } catch (e) {
                console.error(e);
                addLog("Error starting mission.", "text-red-500");
            }
        };

        const claimMission = async () => {
            if (!player.value) return;
            stopAutoFarm();
            try {
                const res = await fetch(`http://localhost:8000/player/${player.value.id}/mission/claim`, { method: 'POST' });
                if (!res.ok) throw new Error("Failed to claim mission");
                const data = await res.json();
                addLog(`Mission Complete! Rewards: ${data.rewards.xp} XP, ${data.rewards.gold} Gold`, "text-yellow-400 font-bold");
                await api.refreshPlayer();
            } catch (e) {
                console.error(e);
                addLog("Error claiming mission.", "text-red-500");
            }
        };

        return {
            player,
            availableMissions,
            getMissionClass,
            selectMission,
            isMissionCompleted,
            getMissionProgress,
            getMissionProgressPercent,
            canClaim,
            startMission,
            claimMission
        };
    }
};
