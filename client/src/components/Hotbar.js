import { ref, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player } from '../state.js';
import { api } from '../services/api.js';

export default {
    emits: ['open-editor'],
    template: `
        <div class="fixed bottom-0 left-0 w-full bg-gray-900/90 backdrop-blur-sm border-t border-gray-700 flex items-center justify-center gap-2 p-2 z-40 h-20 relative">
            <div v-for="i in 5" :key="i"
                class="w-12 h-12 bg-gray-800 border border-gray-600 rounded flex flex-col items-center justify-center relative cursor-pointer hover:border-gray-400 transition-colors group"
                @click="useHotkey(i)">
                <span class="absolute top-0 left-1 text-[10px] text-gray-500 font-bold">{{ i }}</span>

                <!-- Slot Content -->
                <div v-if="getHotkeyItem(i)" class="flex flex-col items-center">
                    <span class="text-xl">{{ getHotkeyItem(i).icon }}</span>
                    <span class="text-[10px] font-bold text-white absolute bottom-0 right-1">x{{ getHotkeyItem(i).quantity }}</span>
                    
                    <!-- Tooltip -->
                    <div class="absolute bottom-14 hidden group-hover:block bg-black text-white text-xs p-1 rounded whitespace-nowrap z-50">
                        {{ getHotkeyItem(i).name }}
                    </div>
                </div>
                <div v-else class="text-gray-600 text-xs">Empty</div>
            </div>

            <!-- Admin Button -->
            <button v-if="player && player.is_admin" 
                @click="$emit('open-editor')"
                class="absolute right-4 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-bold shadow-lg">
                Map Editor
            </button>
        </div>
    `,
    setup() {
        const getHotkeyItem = (index) => {
            if (!player.value) return null;
            // Simple logic: first 5 consumables in inventory map to 1-5
            const consumables = player.value.inventory.filter(i => i.type === 'consumable');
            return consumables[index - 1] || null;
        };

        const useHotkey = async (index) => {
            const item = getHotkeyItem(index);
            if (item) {
                await api.useItem(item.id);
            }
        };

        return {
            player,
            getHotkeyItem,
            useHotkey
        };
    }
};
