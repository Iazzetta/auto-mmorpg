import { player, availableMissions } from '../state.js';

import { computed, onMounted, ref, Teleport } from 'vue';
import { api } from '../services/api.js';
import { API_BASE_URL } from '../config.js';

export default {
    emits: ['open-inventory', 'open-missions', 'open-attributes', 'open-rewards'],
    template: `
        <header class="fixed top-0 left-0 w-full bg-gray-900/90 backdrop-blur-sm p-2 border-b border-gray-700 flex justify-between items-center z-40 h-16">
            
            <!-- Left: Player Info -->
            <div v-if="player" class="flex items-center gap-4 ml-2 cursor-pointer hover:bg-gray-800/50 p-1 rounded transition-colors" @click="showLogout = true">
                <!-- Avatar/Class Icon -->
                <div class="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl border border-gray-600 shadow-inner">
                    {{ player.p_class === 'warrior' ? '⚔️' : player.p_class === 'mage' ? '🧙' : '🏹' }}
                </div>
                
                <div>
                    <div class="font-bold text-yellow-400 leading-tight text-sm">{{ player.name }} <span class="text-gray-500 text-xs">Lvl {{ player.level }}</span></div>
                    
                    <!-- Resources -->
                    <div class="flex gap-3 text-xs mt-1">
                        <div class="flex items-center gap-1 text-yellow-300 font-mono" title="Gold">
                            <span>💰</span> {{ player.gold }}
                        </div>
                        <div class="flex items-center gap-1 text-blue-300 font-mono" title="Diamonds">
                            <span>💎</span> {{ player.diamonds || 0 }}
                        </div>
                    </div>
                </div>

                <!-- Bars -->
                <div class="w-32 flex flex-col gap-1 ml-2">
                     <!-- HP Bar -->
                    <div class="w-full bg-gray-800 rounded-full h-2 relative border border-gray-700">
                        <div class="bg-red-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: (player.stats.hp / player.stats.max_hp * 100) + '%' }"></div>
                        <span class="absolute top-0 left-0 w-full text-center text-[8px] leading-none mt-[1px] text-white drop-shadow-md">{{ player.stats.hp }}/{{ player.stats.max_hp }}</span>
                    </div>
                    <!-- XP Bar -->
                    <div class="w-full bg-gray-800 rounded-full h-2 relative border border-gray-700">
                        <div class="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: ((player.xp / (player.next_level_xp || 100)) * 100) + '%' }"></div>
                        <span class="absolute top-0 left-0 w-full text-center text-[8px] leading-none mt-[1px] text-white drop-shadow-md">{{ player.xp }}/{{ player.next_level_xp }}</span>
                    </div>
                </div>
            </div>
            <div v-else class="w-1/3"></div>

            <!-- Center: Logo -->
            <div class="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 pointer-events-none">
                <h1 class="text-2xl font-bold text-yellow-500 tracking-wider shadow-yellow-500/20 drop-shadow-lg font-serif">AIM Online</h1>
            </div>

            <!-- Right: Menus -->
            <div v-if="player" class="flex gap-2 mr-2">
                <button @click="$emit('open-inventory')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm flex items-center gap-2 transition-all active:scale-95" title="Inventory (E)">
                    <span>🎒</span>
                    <span class="hidden md:inline">Bag</span>
                </button>
                <button @click="$emit('open-attributes')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm flex items-center gap-2 relative transition-all active:scale-95" title="Character (P)">
                    <span>💪</span>
                    <span class="hidden md:inline">Character</span>
                    <span v-if="player.attribute_points > 0" class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                    <span v-if="player.attribute_points > 0" class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                </button>
                <button @click="$emit('open-rewards')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm flex items-center gap-2 transition-all active:scale-95" title="Rewards (R)">
                    <span>🎉</span>
                    <span class="hidden md:inline">Rewards</span>
                </button>
            </div>

            <!-- Logout Modal -->
            <!-- Logout Modal -->
            <Teleport to="body">
                <div v-if="showLogout" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]" @click.self="showLogout = false">
                    <div class="bg-gray-800 border border-gray-600 p-6 rounded-lg shadow-xl w-80 text-center">
                        <div class="text-4xl mb-4">👤</div>
                        <h2 class="text-xl font-bold text-white mb-2">{{ player.name }}</h2>
                        <p class="text-gray-400 text-sm mb-6">Level {{ player.level }} {{ player.p_class }}</p>
                        
                        <div class="space-y-3">
                            <button @click="logout" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded transition-colors">
                                Logout
                            </button>
                            <button @click="showLogout = false" class="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </header>
    `,
    setup() {
        const showLogout = ref(false);

        const hasCompletedMission = computed(() => {
            if (!player.value || !player.value.active_mission_id) return false;
            const mission = availableMissions.value[player.value.active_mission_id];
            if (!mission) return false;
            return player.value.mission_progress >= mission.target_count;
        });

        const logout = () => {
            localStorage.removeItem('rpg_player_id');
            localStorage.removeItem('rpg_player_token');
            player.value = null;
            showLogout.value = false;
            window.location.reload();
        };

        onMounted(async () => {
            // Ensure missions are loaded
            if (Object.keys(availableMissions.value).length === 0) {
                const res = await fetch(`${API_BASE_URL}/content/missions`);
                if (res.ok) {
                    availableMissions.value = await res.json();
                }
            }
        });

        return { player, hasCompletedMission, showLogout, logout };
    }
};
