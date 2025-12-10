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

                <!-- Tabs -->
                <div class="flex gap-4 border-b border-gray-700 px-2">
                    <button @click="activeTab = 'bag'" class="pb-2 text-sm font-bold transition-colors border-b-2" :class="activeTab === 'bag' ? 'text-white border-purple-500' : 'text-gray-500 border-transparent hover:text-gray-300'">
                        🎒 Bag
                    </button>
                    <!-- Locked if Level < 20 (Simulated by checking player level, assumed logic ok for now) -->
                    <!-- TODO: Proper level check if needed, but requirements said Lv 20. -->
                    <button v-if="player.level >= 20 || true" @click="activeTab = 'improve'" class="pb-2 text-sm font-bold transition-colors border-b-2" :class="activeTab === 'improve' ? 'text-white border-yellow-500' : 'text-gray-500 border-transparent hover:text-gray-300'">
                         ✨ Improve <span class="bg-yellow-900/50 text-yellow-500 text-[9px] px-1 rounded ml-1">NEW</span>
                    </button>
                    <button v-else class="pb-2 text-sm font-bold text-gray-700 border-b-2 border-transparent cursor-not-allowed" title="Unlocks at Lv 20">
                         🔒 Improve
                    </button>
                </div>

                <div class="flex gap-4 h-full overflow-hidden flex-1 pt-2">
                    
                    <!-- TAB: BAG -->
                    <template v-if="activeTab === 'bag'">
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
                                    <div v-for="slot in ['head', 'chest', 'legs', 'boots', 'hand_main', 'hand_off']" :key="slot"
                                        class="aspect-square bg-gray-900/80 rounded-lg border flex flex-col items-center justify-center relative group transition-all hover:bg-gray-800"
                                        :class="getSlotBorderClass(player.equipment[slot])"
                                        @click="player.equipment[slot] ? openItemDetails(player.equipment[slot]) : null">
                                        
                                        <span class="absolute top-0.5 left-1 text-[8px] font-bold text-gray-600 uppercase tracking-wider">{{ slot.replace('_', ' ') }}</span>
                                        
                                        <div v-if="player.equipment[slot]" class="flex flex-col items-center w-full px-1">
                                            <div class="text-2xl mb-0.5 filter drop-shadow-md transform group-hover:scale-110 transition-transform">{{ getItemIcon(player.equipment[slot]) }}</div>
                                            <!-- Upgrade Level Indicator -->
                                            <div v-if="player.equipment[slot].enhancement_level" class="absolute top-0.5 right-1 text-[9px] font-black text-yellow-400">
                                                +{{ player.equipment[slot].enhancement_level }}
                                            </div>
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
                                    📦 Items <span class="bg-gray-700 px-1.5 py-0.5 rounded text-[10px] text-white">{{ player.inventory.length }}</span>
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
                                        
                                        <!-- Upgrade Level Indicator -->
                                        <div v-if="item.enhancement_level" class="absolute top-0.5 left-0.5 bg-black/50 px-1 rounded text-[8px] font-gold text-yellow-500">
                                            +{{ item.enhancement_level }}
                                        </div>

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
                    </template>

                    <!-- TAB: IMPROVE -->
                    <template v-if="activeTab === 'improve'">
                         <!-- Left: Upgrade Station -->
                        <div class="w-1/3 flex flex-col gap-3">
                            <div class="bg-gray-900/80 p-4 rounded-xl border border-yellow-900/30 flex-1 flex flex-col items-center justify-center relative shadow-inner shadow-black/50">
                                
                                <h3 class="absolute top-4 font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 to-yellow-600 uppercase tracking-widest text-sm">Anvil of Creation</h3>
                                
                                <!-- Result Message -->
                                <div v-if="upgradeResult" class="absolute top-12 px-2 py-1 rounded text-[10px] font-bold text-center w-full" 
                                    :class="upgradeResult.success ? 'bg-green-900/80 text-green-200' : 'bg-red-900/80 text-red-200'">
                                    {{ upgradeResult.message }}
                                </div>

                                <!-- Slots -->
                                <div class="flex flex-col items-center gap-4 mt-8">
                                    <!-- Item Slot -->
                                    <div class="w-24 h-24 bg-gray-950 rounded-lg border-2 flex items-center justify-center relative shadow-xl"
                                        :class="upgradeSlot ? getSlotBorderClass(upgradeSlot) : 'border-gray-800 border-dashed'">
                                        
                                        <div v-if="upgradeSlot" class="text-5xl animate-in zoom-in duration-300">{{ getItemIcon(upgradeSlot) }}</div>
                                        <div v-else class="text-gray-800 text-4xl select-none">?</div>

                                        <div v-if="upgradeSlot && upgradeSlot.enhancement_level" class="absolute -top-2 -right-2 bg-yellow-600 text-white font-black text-xs px-1.5 py-0.5 rounded shadow border border-yellow-400">
                                            +{{ upgradeSlot.enhancement_level }}
                                        </div>
                                    </div>
                                    
                                    <div class="text-gray-500 text-xs">🡇</div>

                                    <!-- Catalyst Cost -->
                                    <div class="flex items-center gap-2 bg-gray-800/80 px-3 py-1.5 rounded-full border border-gray-700">
                                        <span class="text-xl">🔮</span>
                                        <div class="flex flex-col leading-none">
                                            <span class="text-[9px] text-gray-400 uppercase font-bold">Catalyst Cost</span>
                                            <span class="font-mono font-bold" :class="catalystCount >= upgradeCost ? 'text-white' : 'text-red-500'">
                                                {{ upgradeCost }} <span class="text-gray-500 text-[9px]">/ {{ catalystCount }}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Button -->
                                    <button 
                                        @click="handleUpgrade"
                                        :disabled="!canUpgrade || isUpgrading"
                                        class="mt-2 w-full py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2"
                                        :class="canUpgrade ? 'bg-gradient-to-r from-yellow-600 to-red-600 hover:from-yellow-500 hover:to-red-500 text-white shadow-yellow-900/50' : 'bg-gray-800 text-gray-500 cursor-not-allowed'">
                                        <span v-if="isUpgrading" class="animate-spin">⚙️</span>
                                        {{ isUpgrading ? 'Forging...' : 'IMPROVE' }}
                                    </button>
                                </div>

                                <div class="mt-4 text-[9px] text-gray-500 text-center px-4">
                                    <p>Can improve Rare, Epic, and Legendary items.</p>
                                    <p class="mt-1 text-red-400/80" v-if="upgradeSlot && upgradeSlot.enhancement_level >= 3">⚠️ Failure may consume Catalysts!</p>
                                </div>
                            </div>
                        </div>

                        <!-- Right: Selectable Items -->
                         <div class="w-2/3 flex flex-col gap-3">
                             <div class="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50 text-xs font-bold text-gray-400 text-center uppercase tracking-wider">
                                 Select Item to Upgrade
                             </div>

                             <div class="bg-gray-800/30 rounded-lg border border-gray-700/50 flex-1 overflow-y-auto p-3 custom-scrollbar">
                                <div class="grid grid-cols-5 gap-2">
                                    <div v-for="item in upgradeableItems" :key="item.id"
                                        class="aspect-square bg-gray-900/80 rounded border flex flex-col items-center justify-center relative group cursor-pointer hover:scale-105 transition-all"
                                        :class="[getSlotBorderClass(item), upgradeSlot && upgradeSlot.id === item.id ? 'ring-2 ring-yellow-400' : '']"
                                        @click="selectForUpgrade(item)">
                                        
                                        <div class="text-2xl mb-0.5">{{ getItemIcon(item) }}</div>
                                         <!-- Level -->
                                        <div v-if="item.enhancement_level" class="absolute top-0.5 right-0.5 text-[8px] font-bold text-yellow-500">
                                            +{{ item.enhancement_level }}
                                        </div>
                                        <div class="absolute bottom-0.5 w-full text-center px-0.5">
                                             <div class="text-[8px] font-bold truncate" :class="getRarityTextColor(item.rarity)">
                                                {{ item.name }}
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Empty state if no items -->
                                    <div v-if="upgradeableItems.length === 0" class="col-span-5 text-center text-gray-500 text-xs py-10">
                                        No upgradeable items found.<br>(Need Rare+ items)
                                    </div>
                                </div>
                             </div>
                         </div>
                    </template>
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
                            <div class="flex items-center gap-1">
                                <span class="text-yellow-400 font-bold font-mono text-base">{{ selectedItem.power_score }}</span>
                                <span v-if="selectedItem.enhancement_level" class="text-[10px] text-yellow-600 font-bold">(+{{ Math.floor(selectedItem.power_score * ((Math.pow(1.05, selectedItem.enhancement_level) - 1))) }})</span>
                            </div>
                        </div>
                        
                        <!-- Enhancement Stats Breakdown -->
                        <div v-for="(val, stat) in selectedItem.stats" :key="stat">
                            <div v-if="val > 0" class="flex justify-between text-xs">
                                <span class="text-gray-400 capitalize">{{ stat.replace('def_', 'Defense') }}</span>
                                <div class="flex items-center gap-1">
                                    <span class="font-bold text-gray-200">{{ val }}</span>
                                    <!-- Show Bonus if enhanced -->
                                    <span v-if="selectedItem.enhancement_level" class="text-yellow-500 font-bold text-[10px]">
                                        (+{{ Math.floor(val * ((Math.pow(1.05, selectedItem.enhancement_level)) - 1)) }})
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Awakenings Preview -->
                        <div v-if="selectedItem.enhancement_level" class="mt-3 pt-2 border-t border-gray-700/50">
                            <div class="flex justify-between items-center mb-1">
                                <div class="text-[10px] text-gray-500 uppercase font-bold">Awakenings</div>
                                <div class="text-[8px] text-gray-600 italic">Unlocks at +3, +6, +9, +12, +15</div>
                            </div>
                            
                            <!-- Progress Bar -->
                            <div class="grid grid-cols-5 gap-1 mb-2">
                                <div v-for="lvl in [3, 6, 9, 12, 15]" :key="lvl" 
                                    class="h-1.5 rounded-full transition-all duration-300"
                                    :class="selectedItem.enhancement_level >= lvl ? 'bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.5)]' : 'bg-gray-800'">
                                </div>
                            </div>

                            <!-- Active Buffs List -->
                            <div v-if="selectedItem.awakenings && selectedItem.awakenings.length > 0" class="flex flex-col gap-1">
                                <div v-for="(buff, idx) in selectedItem.awakenings" :key="idx" 
                                     class="flex items-center gap-2 text-xs text-purple-300 bg-purple-900/20 px-2 py-1 rounded border border-purple-500/20">
                                    <span>✨</span>
                                    <span class="font-bold">
                                        {{ formatBuffLabel(buff.type) }} 
                                        <span class="text-purple-100">+{{ Math.round(buff.value * 1000) / 10 }}%</span>
                                    </span>
                                </div>
                            </div>
                            <div v-else-if="selectedItem.enhancement_level >= 3" class="text-[10px] text-gray-500 italic text-center">
                                No buffs found (Old item? Re-roll needed)
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
        const activeTab = ref('bag'); // 'bag' or 'improve'
        const upgradeSlot = ref(null);
        const upgradeResult = ref(null); // { success: bool, message: str }
        const isUpgrading = ref(false);

        watch(autoSellInferior, (val) => {
            localStorage.setItem('rpg_auto_sell', val);
            if (val) {
                api.triggerAutoSell();
            }
        });

        // Close modal resets tab (optional)
        // watch(() => props.isOpen, (val) => { if(!val) activeTab.value = 'bag'; });

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

        // --- Enhancement System ---
        const catalystCount = computed(() => {
            const cats = player.value.inventory.filter(i => i.id.startsWith('item_catalyst'));
            return cats.reduce((sum, i) => sum + i.quantity, 0);
        });

        const upgradeCost = computed(() => {
            if (!upgradeSlot.value) return 0;
            // Base Cost Logic (Replicated from Backend basically, or fetched?)
            // Ideally backend returns cost. 
            // Simplifying: Base 1 + Level. Epic+1, Leg+2.
            let base = 1;
            if (upgradeSlot.value.rarity === 'epic') base = 2;
            if (upgradeSlot.value.rarity === 'legendary') base = 3;
            // Typo default was rate -> rare? assuming rare=1

            return base + (upgradeSlot.value.enhancement_level || 0);
        });

        const canUpgrade = computed(() => {
            if (!upgradeSlot.value) return false;
            return catalystCount.value >= upgradeCost.value && (upgradeSlot.value.enhancement_level || 0) < 15;
        });

        const selectForUpgrade = (item) => {
            upgradeSlot.value = item;
            upgradeResult.value = null;
        };

        const handleUpgrade = async () => {
            if (!canUpgrade.value || isUpgrading.value) return;

            isUpgrading.value = true;
            upgradeResult.value = null;

            // Call API via service
            const result = await api.upgradeItem(upgradeSlot.value.id);

            if (result.success) {
                upgradeResult.value = { success: true, message: result.message };
                upgradeSlot.value = result.item;
            } else {
                upgradeResult.value = { success: false, message: result.message };
            }

            isUpgrading.value = false;
        };

        const getItemIcon = api.getItemIcon || ((item) => item.icon || '📦');

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

        const upgradeableItems = computed(() => {
            return player.value.inventory.filter(i =>
                (i.type === 'weapon' || i.type === 'armor') &&
                ['rare', 'epic', 'legendary'].includes(i.rarity)
            );
        });

        const formatBuffLabel = (type) => {
            const labels = {
                "pct_atk": "Attack",
                "pct_def": "Defense",
                "pct_hp": "Max HP",
                "pct_speed": "Speed",
                "crit_rate": "Crit Rate",
                "crit_dmg": "Crit Dmg",
                "lifesteal": "Lifesteal"
            };
            return labels[type] || type;
        };

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
            totalPowerScore,
            // New Refs
            activeTab,
            upgradeSlot,
            upgradeResult,
            isUpgrading,
            catalystCount,
            upgradeCost,
            canUpgrade,
            selectForUpgrade,
            handleUpgrade,
            upgradeableItems,
            formatBuffLabel
        };
    }
};
