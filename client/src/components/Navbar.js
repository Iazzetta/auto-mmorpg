import { player } from '../state.js';

export default {
    emits: ['open-inventory', 'open-missions', 'open-attributes', 'open-events'],
    template: `
        <header class="fixed top-0 left-0 w-full bg-gray-900/90 backdrop-blur-sm p-2 border-b border-gray-700 flex justify-between items-center z-40 h-14">
            <div class="flex items-center gap-4">
                <h1 class="text-xl font-bold text-yellow-500 ml-2">⚔️ Auto RPG</h1>
            </div>

            <div v-if="player" class="flex gap-2">
                <button @click="$emit('open-missions')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded text-sm flex items-center gap-2">
                    📜 Missions
                </button>
                <button @click="$emit('open-inventory')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded text-sm flex items-center gap-2">
                    🎒 Bag (E)
                </button>
                <button @click="$emit('open-attributes')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded text-sm flex items-center gap-2 relative">
                    💪 Stats
                    <span v-if="player.attribute_points > 0" class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                </button>
                <button @click="$emit('open-events')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded text-sm flex items-center gap-2">
                    🎉 Events
                </button>
            </div>

            <div v-if="player" class="flex items-center gap-4 mr-2">
                <div class="text-right">
                    <div class="text-xs text-gray-400">Level {{ player.level }} {{ player.p_class }}</div>
                    <div class="font-bold text-yellow-400">{{ player.name }}</div>
                </div>
                <div class="w-32">
                    <!-- HP Bar -->
                    <div class="w-full bg-gray-800 rounded-full h-2 mb-1 relative">
                        <div class="bg-red-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: (player.stats.hp / player.stats.max_hp * 100) + '%' }"></div>
                        <span class="absolute top-0 left-0 w-full text-center text-[8px] leading-none mt-[1px] text-white drop-shadow-md">{{ player.stats.hp }}/{{ player.stats.max_hp }}</span>
                    </div>
                    <!-- XP Bar -->
                    <div class="w-full bg-gray-800 rounded-full h-2 relative">
                        <div class="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: ((player.xp / (player.next_level_xp || 100)) * 100) + '%' }"></div>
                        <span class="absolute top-0 left-0 w-full text-center text-[8px] leading-none mt-[1px] text-white drop-shadow-md">{{ player.xp }}/{{ player.next_level_xp }}</span>
                    </div>
                </div>
            </div>
            <div v-else>
                <!-- Login/Create is handled in App.js overlay -->
            </div>
        </header>
    `,
    setup() {
        return { player };
    }
};
