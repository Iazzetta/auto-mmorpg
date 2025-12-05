import { player, availableMissions } from '../state.js';
import { computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { api } from '../services/api.js';

export default {
    emits: ['open-inventory', 'open-missions', 'open-attributes', 'open-rewards'],
    template: `
        <header class="fixed top-0 left-0 w-full bg-gray-900/90 backdrop-blur-sm p-2 border-b border-gray-700 flex justify-between items-center z-40 h-16">
            
            <!-- Left: Player Info -->
            <div v-if="player" class="flex items-center gap-4 ml-2">
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
                <h1 class="text-2xl font-bold text-yellow-500 tracking-wider shadow-yellow-500/20 drop-shadow-lg font-serif">⚔️ AUTO RPG</h1>
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
        </header>
    `,
    setup() {
        const hasCompletedMission = computed(() => {
            if (!player.value || !player.value.active_mission_id) return false;
            const mission = availableMissions.value[player.value.active_mission_id];
            if (!mission) return false;
            return player.value.mission_progress >= mission.target_count;
        });

        onMounted(async () => {
            // Ensure missions are loaded
            if (Object.keys(availableMissions.value).length === 0) {
                const res = await fetch('http://localhost:8000/content/missions');
                if (res.ok) {
                    availableMissions.value = await res.json();
                }
            }
        });

        return { player, hasCompletedMission };
    }
};
