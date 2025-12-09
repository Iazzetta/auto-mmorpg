import { ref, computed, watch } from 'vue';
import { player, autoSellInferior } from '../state.js';
import { api, getRarityColor } from '../services/api.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity" @click.self="$emit('close')">
            <div class="bg-gray-900/95 p-5 rounded-xl border border-gray-700 shadow-2xl max-w-3xl w-full relative text-gray-100 flex flex-col gap-3 h-[550px]">
                
                <!-- Header -->
                <div class="flex justify-between items-center border-b border-gray-700 pb-2">
                    <div>
                        <h3 class="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">INVENTORY</h3>
                        <p class="text-gray-400 text-[10px] mt-0.5">Manage your gear.</p>
                    </div>
                    <button @click="$emit('close')" class="text-gray-500 hover:text-white transition-colors text-lg">✕</button>
                </div>

                <div class="flex gap-4 h-full overflow-hidden">
                    
                    <!-- Left: Equipment (Fixed) -->
                    <div class="w-1/3 flex flex-col gap-3">
                        <div class="bg-gray-800/40 p-3 rounded-lg border border-gray-700/50 flex-1 flex flex-col justify-center relative">
                            <!-- Helper / Total Power -->
                            <div class="absolute top-2 left-0 w-full text-center">
                                <span class="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Power Store</span>
                                <div class="text-2xl font-black text-yellow-400 drop-shadow-md">{{ totalPowerScore }}</div>
                            </div>

                            <!-- Slots Grid -->
                            <div class="grid grid-cols-2 gap-2 mt-6">
                                <div v-for="slot in ['head', 'chest', 'legs', 'boots', 'weapon_main', 'weapon_off']" :key="slot"
                                    class="aspect-square bg-gray-900/80 rounded-lg border flex flex-col items-center justify-center relative group transition-all hover:bg-gray-800"
                                    :class="getSlotBorderClass(player.equipment[slot])"
                                    @click="player.equipment[slot] ? openItemDetails(player.equipment[slot]) : null">
                                    
                                    <span class="absolute top-0.5 left-1 text-[8px] font-bold text-gray-600 uppercase tracking-wider">{{ slot.replace('_', ' ') }}</span>
                                    
                                    <div v-if="player.equipment[slot]" class="flex flex-col items-center w-full px-1">
                                        <div class="text-2xl mb-0.5 filter drop-shadow-md transform group-hover:scale-110 transition-transform">{{ getItemIcon(player.equipment[slot]) }}</div>
                                        <div class="text-[9px] font-bold text-center truncate w-full" :class="getRarityTextColor(player.equipment[slot].rarity)">
                                            {{ player.equipment[slot].name }}
                                        </div>
                                    </div>
                                    <div v-else class="text-gray-700 text-xl opacity-20 font-bold">+</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Inventory (Grid) -->
                    <div class="w-2/3 flex flex-col gap-3">
                        <!-- Toolbar -->
                        <div class="flex justify-between items-center bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                            <span class="text-xs font-bold text-gray-300 flex items-center gap-2">
                                🎒 Bag <span class="bg-gray-700 px-1.5 py-0.5 rounded text-[10px] text-white">{{ player.inventory.length }}</span>
                            </span>
                            <label class="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" v-model="autoSellInferior" class="form-checkbox bg-gray-700 border-gray-600 rounded text-purple-500 focus:ring-0 w-3 h-3">
                                Auto-sell Inferior
                            </label>
                        </div>

                        <!-- Grid -->
                        <div class="bg-gray-800/30 rounded-lg border border-gray-700/50 flex-1 overflow-y-auto p-3 custom-scrollbar">
                            <div class="grid grid-cols-5 gap-2">
                                <div v-for="item in player.inventory" :key="item.id"
                                    class="aspect-square bg-gray-900/80 rounded border flex flex-col items-center justify-center relative group cursor-pointer hover:scale-105 transition-all hover:shadow-md hover:z-10"
                                    :class="getSlotBorderClass(item)"
                                    @click="openItemDetails(item)">
                                    
                                    <div class="text-2xl mb-0.5">{{ getItemIcon(item) }}</div>
                                    <div class="absolute bottom-0.5 w-full text-center px-0.5">
                                         <div class="text-[8px] font-bold truncate" :class="getRarityTextColor(item.rarity)">
                                            {{ item.name }}
                                        </div>
                                    </div>
                                    
                                    <div v-if="item.quantity > 1"
                                        class="absolute top-0 right-0 bg-gray-950/80 text-white text-[8px] px-1 py-0 rounded-bl font-mono border-l border-b border-gray-700">
                                        x{{ item.quantity }}
                                    </div>
                                </div>
                                <!-- Empty Slots Fillers -->
                                <div v-for="n in Math.max(0, 30 - player.inventory.length)" :key="'empty'+n"
                                    class="aspect-square bg-gray-900/30 rounded border border-gray-800/50 flex items-center justify-center">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Item Details Modal (Nested) -->
            <div v-if="selectedItem" class="absolute inset-0 flex items-center justify-center z-[60] backdrop-blur-sm bg-black/50" @click.self="selectedItem = null">
                <div class="bg-gray-900 p-5 rounded-xl border border-gray-600 shadow-2xl max-w-xs w-full relative animate-in fade-in zoom-in duration-200">
                    <button @click="selectedItem = null" class="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors">✕</button>
                    
                    <div class="text-center mb-4">
                        <div class="text-5xl mb-2 filter drop-shadow-xl">{{ getItemIcon(selectedItem) }}</div>
                        <h3 class="text-lg font-bold" :class="getRarityTextColor(selectedItem.rarity)">{{ selectedItem.name }}</h3>
                        <div class="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{{ selectedItem.rarity }} {{ selectedItem.type }}</div>
                    </div>

                    <div class="bg-gray-800/50 p-3 rounded-lg mb-4 space-y-1.5 border border-gray-700/50">
                        <div v-if="selectedItem.power_score" class="flex justify-between items-center pb-1.5 border-b border-gray-700/50">
                            <span class="text-gray-400 text-xs">Power Score</span> 
                            <span class="text-yellow-400 font-bold font-mono text-base">{{ selectedItem.power_score }}</span>
                        </div>
                        <div v-for="(val, stat) in selectedItem.stats" :key="stat">
                            <div v-if="val > 0" class="flex justify-between text-xs">
                                <span class="text-gray-400 capitalize">{{ stat.replace('def_', 'Defense') }}</span>
                                <span class="font-bold text-gray-200">+{{ val }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <template v-if="isEquipped(selectedItem)">
                            <button @click="handleUnequip(selectedItem.slot)" class="flex-1 bg-yellow-700 hover:bg-yellow-600 py-2 rounded-lg font-bold text-white text-sm transition-colors shadow-lg">Unequip</button>
                        </template>
                        <template v-else>
                            <button v-if="selectedItem.type === 'consumable'" @click="useItem(selectedItem.id)" class="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg font-bold text-white text-sm transition-colors shadow-lg shadow-green-900/20">Use</button>
                            <button v-else-if="selectedItem.type === 'weapon' || selectedItem.type === 'armor'" @click="equipItem(selectedItem.id)" class="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold text-white text-sm transition-colors shadow-lg shadow-blue-900/20">Equip</button>
                            <button @click="sellItem(selectedItem.id)" class="flex-1 bg-red-900/80 hover:bg-red-700 py-2 rounded-lg font-bold text-red-200 text-sm border border-red-800 transition-colors">Sell</button>
                        </template>
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
            if (!item || !item.id) return false;
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

        const handleUnequip = async (slot) => {
            await api.unequipItem(slot);
            selectedItem.value = null;
        };

        const sellItem = async (id) => {
            await api.sellItem(id);
            selectedItem.value = null;
        };

        const getItemIcon = api.getItemIcon || ((item) => item.icon || '📦');
        // If api.getItemIcon is not exported directly, we might need to import or duplicate it.
        // Looking at api.js, getItemIcon is exported.
        // We imported api from ../services/api.js, usually as default or named?
        // Let's check imports.

        const getRarityTextColor = (rarity) => {
            const colors = {
                common: 'text-gray-400',
                uncommon: 'text-green-400',
                rare: 'text-blue-400',
                epic: 'text-purple-500',
                legendary: 'text-yellow-400'
            };
            return colors[rarity] || 'text-gray-300';
        };

        const getSlotBorderClass = (item) => {
            if (!item) return 'border-gray-700';
            const colors = {
                common: 'border-gray-500',
                uncommon: 'border-green-500/50 bg-green-900/20',
                rare: 'border-blue-500/50 bg-blue-900/20',
                epic: 'border-purple-500/50 bg-purple-900/20',
                legendary: 'border-yellow-500/50 bg-yellow-900/20'
            };
            return colors[item.rarity] || 'border-gray-500';
        };

        const totalPowerScore = computed(() => {
            if (!player.value) return 0;
            return Object.values(player.value.equipment).reduce((acc, item) => acc + (item ? (item.power_score || 0) : 0), 0);
        });

        return {
            player,
            selectedItem,
            isEquipped,
            useItem,
            equipItem,
            handleUnequip,
            sellItem,
            autoSellInferior,
            openItemDetails: (item) => selectedItem.value = item,
            getItemIcon,
            getRarityTextColor,
            getSlotBorderClass,
            totalPowerScore
        };
    }
};
