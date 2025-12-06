import { ref, computed, watch } from 'vue';
import { getRarityColor } from '../services/api.js';

export default {
    props: ['player', 'isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen && player" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" @click.self="$emit('close')">
            <div class="bg-gray-800 p-6 rounded-lg border border-gray-600 shadow-2xl max-w-sm w-full relative">
                <button @click="$emit('close')" class="absolute top-2 right-2 text-gray-400 hover:text-white">✕</button>
                
                <div class="text-center mb-6">
                    <h2 class="text-2xl font-bold text-yellow-500">{{ player.name }}</h2>
                    <div class="text-gray-400 text-sm">Level {{ player.level }} {{ player.p_class }}</div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-gray-700 p-2 rounded text-center">
                        <div class="text-xs text-gray-400">HP</div>
                        <div class="font-bold text-green-400">{{ player.hp }}/{{ player.max_hp }}</div>
                    </div>
                    <div class="bg-gray-700 p-2 rounded text-center">
                        <div class="text-xs text-gray-400">State</div>
                        <div class="font-bold capitalize" :class="player.state === 'combat' ? 'text-red-400' : 'text-blue-400'">{{ player.state }}</div>
                    </div>
                </div>

                <!-- Equipment Preview (Simplified) -->
                <!-- Note: The map players endpoint currently returns limited info. 
                     If we want full equipment, we might need to fetch full details on click. 
                     For now, let's assume we might fetch it or just show what we have. 
                     Actually, the user asked for "equipamentos equipados".
                     The current /map/players endpoint only returns basic stats.
                     We need a new endpoint /player/{id}/inspect or just use get_player if allowed.
                -->
                <div v-if="details" class="space-y-2">
                    <h3 class="font-bold text-gray-300 border-b border-gray-600 pb-1 mb-2">Equipment</h3>
                    <div v-for="(item, slot) in details.equipment" :key="slot" class="flex justify-between items-center text-sm">
                        <span class="text-gray-500 capitalize">{{ slot.replace('_', ' ') }}</span>
                        <span v-if="item" :class="getRarityColor(item.rarity)">{{ item.name }}</span>
                        <span v-else class="text-gray-600">-</span>
                    </div>
                </div>
                <div v-else class="text-center text-gray-500 text-sm italic">
                    Loading details...
                </div>

            </div>
        </div>
    `,
    setup(props) {
        const details = ref(null);

        // Watch for player prop change to fetch details

        watch(() => props.player, async (newPlayer) => {
            if (newPlayer) {
                details.value = null;
                try {
                    // Reuse fetchPlayer but don't set global player state?
                    // Or create a specific inspect fetch.
                    // Let's use a direct fetch here to avoid messing with global state.
                    const res = await fetch(`http://localhost:8000/player/${newPlayer.id}`);
                    if (res.ok) {
                        details.value = await res.json();
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        });

        return {
            details,
            getRarityColor
        };
    }
};
