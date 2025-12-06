import { ref, computed, watch } from 'vue';
import { player, autoSellInferior } from '../state.js';
import { api, getRarityColor } from '../services/api.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" @click.self="$emit('close')">
            <div class="flex gap-4 w-full max-w-4xl h-[600px] p-4">
                
                <!-- Left: Equipment -->
                <div class="w-1/3 bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col">
                    <h2 class="text-xl font-bold text-white mb-4 border-b border-gray-600 pb-2">Equipment</h2>
                    <div class="flex-1 grid grid-cols-2 gap-4 content-start">
                        <div v-for="(item, slot) in player.equipment" :key="slot"
                            class="bg-gray-700 p-2 rounded flex flex-col items-center justify-center min-h-[100px] text-center border border-gray-600 relative group hover:border-gray-400 transition-colors">
                            <span class="text-xs text-gray-400 uppercase mb-1">{{ slot.replace('_', ' ') }}</span>
                            <div v-if="item" @click="selectedItem = item" class="cursor-pointer w-full">
                                <span :class="getRarityColor(item.rarity)" class="font-bold text-sm block truncate">{{ item.name }}</span>
                                <div class="text-xs text-gray-300">PS: {{ item.power_score }}</div>
                            </div>
                            <div v-else class="text-gray-500 text-3xl">+</div>
                        </div>
                    </div>
                </div>

                <!-- Right: Bag -->
                <div class="w-2/3 bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col">
                    <div class="flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
                        <h2 class="text-xl font-bold text-white">Inventory <span class="text-sm text-gray-400">({{ player.inventory.length }})</span></h2>
                        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                            <input type="checkbox" v-model="autoSellInferior" class="form-checkbox bg-gray-700 border-gray-600 rounded text-blue-500">
                            Auto-sell inferior
                        </label>
                    </div>
                    <div class="flex-1 overflow-y-auto grid grid-cols-5 gap-2 content-start">
                        <div v-for="item in player.inventory" :key="item.id"
                            class="bg-gray-700 p-2 rounded border border-gray-600 hover:border-gray-400 cursor-pointer relative group flex flex-col items-center justify-center h-24"
                            @click="selectedItem = item">
                            <div class="text-3xl mb-1">{{ item.icon || '📦' }}</div>
                            <div class="text-[10px] font-bold truncate w-full text-center" :class="getRarityColor(item.rarity)">
                                {{ item.name }}
                            </div>
                            <div class="text-[10px] text-gray-400">Lvl {{ item.power_score }}</div>
                            <div v-if="item.quantity > 1"
                                class="absolute top-0 right-0 bg-gray-900 text-white text-[10px] px-1 rounded-bl font-bold">
                                x{{ item.quantity }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Item Details Modal (Nested) -->
            <div v-if="selectedItem" class="absolute inset-0 flex items-center justify-center z-60 pointer-events-none">
                <div class="bg-gray-900 p-6 rounded-lg border border-gray-500 shadow-2xl max-w-sm w-full pointer-events-auto relative">
                    <button @click="selectedItem = null" class="absolute top-2 right-2 text-gray-400 hover:text-white">✕</button>
                    
                    <div class="text-center mb-4">
                        <div class="text-4xl mb-2">{{ selectedItem.type === 'consumable' ? '🧪' : '🗡️' }}</div>
                        <h3 :class="getRarityColor(selectedItem.rarity)" class="text-xl font-bold">{{ selectedItem.name }}</h3>
                        <div class="text-sm text-gray-400 capitalize">{{ selectedItem.rarity }} {{ selectedItem.type }}</div>
                        <div v-if="selectedItem.quantity > 1" class="text-sm text-yellow-400 font-bold mt-1">x{{ selectedItem.quantity }}</div>
                    </div>

                    <div class="bg-gray-800 p-3 rounded mb-4 text-sm space-y-1">
                        <div v-if="selectedItem.power_score" class="flex justify-between"><span>Power Score:</span> <span class="text-yellow-400">{{ selectedItem.power_score }}</span></div>
                        <div v-if="selectedItem.stats.hp" class="flex justify-between"><span>Heals:</span> <span class="text-green-400">{{ selectedItem.stats.hp }} HP</span></div>
                        <div v-if="selectedItem.stats.atk" class="flex justify-between"><span>Attack:</span> <span>+{{ selectedItem.stats.atk }}</span></div>
                        <div v-if="selectedItem.stats.def_" class="flex justify-between"><span>Defense:</span> <span>+{{ selectedItem.stats.def_ }}</span></div>
                        <div v-if="selectedItem.stats.strength" class="flex justify-between"><span>Strength:</span> <span>+{{ selectedItem.stats.strength }}</span></div>
                        <div v-if="selectedItem.stats.intelligence" class="flex justify-between"><span>Intelligence:</span> <span>+{{ selectedItem.stats.intelligence }}</span></div>
                        <div v-if="selectedItem.stats.speed" class="flex justify-between"><span>Speed:</span> <span>+{{ selectedItem.stats.speed }}</span></div>
                    </div>

                    <div class="flex gap-2">
                        <button v-if="selectedItem.type === 'consumable'" @click="useItem(selectedItem.id)" class="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded font-bold text-white">Use</button>
                        <button v-else-if="!isEquipped(selectedItem)" @click="equipItem(selectedItem.id)" class="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-white">Equip</button>
                        <button @click="sellItem(selectedItem.id)" class="flex-1 bg-red-700 hover:bg-red-600 py-2 rounded font-bold text-white">Sell</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const selectedItem = ref(null);

        watch(autoSellInferior, (val) => {
            localStorage.setItem('rpg_auto_sell', val);
            if (val) {
                api.triggerAutoSell();
            }
        });

        const isEquipped = (item) => {
            return Object.values(player.value.equipment).some(e => e && e.id === item.id);
        };

        const useItem = async (id) => {
            await api.useItem(id);
            selectedItem.value = null;
        };

        const equipItem = async (id) => {
            await api.equipItem(id);
            selectedItem.value = null;
        };

        const sellItem = async (id) => {
            await api.sellItem(id);
            selectedItem.value = null;
        };

        return {
            player,
            selectedItem,
            getRarityColor,
            isEquipped,
            useItem,
            equipItem,
            sellItem,
            autoSellInferior
        };
    }
};
