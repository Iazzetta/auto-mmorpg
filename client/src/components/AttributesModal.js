import { ref, computed, watch } from 'vue';
import { player } from '../state.js';
import { api } from '../services/api.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity" @click.self="$emit('close')">
            <div class="bg-gray-900/95 p-6 rounded-2xl border border-gray-700 shadow-2xl max-w-3xl w-full relative text-gray-100 flex flex-col gap-4">
                
                <!-- Header -->
                <div class="flex justify-between items-center border-b border-gray-700 pb-2">
                    <div>
                        <h3 class="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">CHARACTER GROWTH</h3>
                        <p class="text-gray-400 text-xs mt-0.5">Allocate points to shape your destiny.</p>
                    </div>
                    <button @click="$emit('close')" class="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <!-- Left: Allocation -->
                    <div class="space-y-3">
                        <div class="flex justify-between items-center bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                            <span class="text-gray-300 font-medium tracking-wide text-sm">AVAILABLE POINTS</span>
                            <span class="text-2xl font-black text-yellow-400 drop-shadow-lg">{{ availablePoints }}</span>
                        </div>

                        <div class="space-y-2">
                            <div v-for="(val, attr) in tempAttributes" :key="attr" class="bg-gray-800/40 p-2.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                                <div class="flex justify-between items-center mb-1.5">
                                    <div class="flex flex-col">
                                        <span class="uppercase font-bold text-sm text-gray-200 tracking-wider">{{ attr }}</span>
                                        <span class="text-[10px] text-gray-500 font-mono">
                                            {{ attr === 'str' ? '+2 Atk' : 
                                               attr === 'agi' ? '+1 Atk, +1 Def' : 
                                               attr === 'vit' ? '+10 HP, +1 Def' : 
                                               '+0.1 Spd, -CDR' }}
                                        </span>
                                    </div>
                                    <span class="font-bold text-lg text-white">{{ val }}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button @click="adjustAttribute(attr, -1)" class="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center font-bold text-lg transition-colors active:scale-95 text-red-300">-</button>
                                    
                                    <div class="flex-1 px-2 relative h-4 flex items-center">
                                         <!-- Custom Slider Track -->
                                        <div class="absolute w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div class="h-full bg-gradient-to-r from-yellow-600 to-yellow-400" 
                                                 :style="{ width: ((tempAttributes[attr] / (val + availablePoints + 20)) * 100) + '%' }"></div>
                                        </div>
                                        <input type="range" 
                                            :min="player.attributes[attr]" 
                                            :max="val + availablePoints" 
                                            v-model.number="tempAttributes[attr]"
                                            class="absolute w-full h-full opacity-0 cursor-pointer">
                                    </div>

                                    <button @click="adjustAttribute(attr, 1)" 
                                        class="w-7 h-7 rounded flex items-center justify-center font-bold text-lg transition-all active:scale-95 shadow-lg"
                                        :class="availablePoints > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
                                        :disabled="availablePoints <= 0">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Projections -->
                    <div class="bg-gray-800/30 rounded-xl p-4 border border-gray-700 flex flex-col h-full">
                        <h4 class="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                            <span class="text-blue-400">📊</span> Live Projections
                        </h4>

                        <div class="space-y-3 flex-1" v-if="projectedStats && projectedStats.hp !== undefined">
                            
                            <!-- Combat Stats Group -->
                            <div class="space-y-1">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1 mb-0.5">Combat Ability</div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50">
                                        <div class="text-gray-400 text-[10px] uppercase">HP</div>
                                        <div class="flex items-end gap-1.5">
                                            <span class="text-sm font-mono font-bold text-white">{{ player.stats.max_hp }}</span>
                                            <span v-if="projectedStats.hp > player.stats.max_hp" class="text-green-400 font-bold text-xs mb-0.5">
                                                ➜ {{ projectedStats.hp }}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50">
                                        <div class="text-gray-400 text-[10px] uppercase">Atk</div>
                                        <div class="flex items-end gap-1.5">
                                            <span class="text-sm font-mono font-bold text-white">{{ player.stats.atk }}</span>
                                            <span v-if="projectedStats.atk > player.stats.atk" class="text-green-400 font-bold text-xs mb-0.5">
                                                ➜ {{ projectedStats.atk }}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50 col-span-2">
                                        <div class="text-gray-400 text-[10px] uppercase">Def</div>
                                        <div class="flex items-end gap-1.5">
                                            <span class="text-sm font-mono font-bold text-white">{{ player.stats.def_ }}</span>
                                            <span v-if="projectedStats.def > player.stats.def_" class="text-green-400 font-bold text-xs mb-0.5">
                                                ➜ {{ projectedStats.def }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Utility Stats Group -->
                            <div class="space-y-1 mt-2">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1 mb-0.5">Mobility & Technique</div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50">
                                        <div class="text-gray-400 text-[10px] uppercase">Spd</div>
                                        <div class="flex items-end gap-1.5">
                                            <span class="text-sm font-mono font-bold text-white">{{ player.stats.speed }}</span>
                                            <span v-if="projectedStats.speed > player.stats.speed" class="text-green-400 font-bold text-xs mb-0.5">
                                                ➜ {{ projectedStats.speed }}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50">
                                        <div class="text-gray-400 text-[10px] uppercase">Cd</div>
                                        <div class="flex items-end gap-1.5">
                                            <span class="text-sm font-mono font-bold text-white">{{ player.stats.attack_cooldown }}s</span>
                                            <span v-if="projectedStats.cooldown < player.stats.attack_cooldown" class="text-green-400 font-bold text-xs mb-0.5">
                                                ➜ {{ projectedStats.cooldown }}s
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Advanced Stats Group -->
                            <div class="space-y-1 mt-2 border-t border-gray-700/50 pt-2">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1 mb-0.5">Advanced Combat</div>
                                <div class="grid grid-cols-3 gap-2">
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50 flex flex-col items-center">
                                        <div class="text-gray-400 text-[9px] uppercase">Crit Rate</div>
                                        <div class="text-xs font-mono font-bold text-purple-300">{{ (player.stats.crit_rate * 100).toFixed(1) }}%</div>
                                    </div>
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50 flex flex-col items-center">
                                        <div class="text-gray-400 text-[9px] uppercase">Crit Dmg</div>
                                        <div class="text-xs font-mono font-bold text-purple-300">{{ (player.stats.crit_dmg * 100).toFixed(0) }}%</div>
                                    </div>
                                    <div class="bg-gray-900/60 p-2 rounded border border-gray-700/50 flex flex-col items-center">
                                        <div class="text-gray-400 text-[9px] uppercase">Lifesteal</div>
                                        <div class="text-xs font-mono font-bold text-red-400">{{ (player.stats.lifesteal * 100).toFixed(1) }}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action -->
                        <div class="mt-4 pt-3 border-t border-gray-700">
                             <button @click="confirmAttributes"
                                class="w-full py-2.5 rounded-lg font-bold text-sm shadow-lg transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                                :class="hasChanges ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-900/50' : 'bg-gray-700 text-gray-400 cursor-not-allowed'"
                                :disabled="!hasChanges">
                                {{ hasChanges ? 'CONFIRM CHANGES' : 'NO CHANGES' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const tempAttributes = ref({});

        const init = () => {
            if (player.value) {
                tempAttributes.value = { ...player.value.attributes };
            }
        };

        init();

        watch(() => props.isOpen, (newVal) => {
            if (newVal) init();
        });

        const availablePoints = computed(() => {
            if (!player.value) return 0;
            const currentSpent = Object.values(tempAttributes.value).reduce((a, b) => a + b, 0);
            const originalSpent = Object.values(player.value.attributes).reduce((a, b) => a + b, 0);
            return player.value.attribute_points - (currentSpent - originalSpent);
        });

        const hasChanges = computed(() => {
            if (!player.value) return false;
            return JSON.stringify(tempAttributes.value) !== JSON.stringify(player.value.attributes);
        });

        const adjustAttribute = (attr, amount) => {
            if (amount > 0 && availablePoints.value <= 0) return;
            if (amount < 0 && tempAttributes.value[attr] <= player.value.attributes[attr]) return;
            tempAttributes.value[attr] += amount;
        };

        const confirmAttributes = async () => {
            const diff = {};
            for (const k in tempAttributes.value) {
                const d = tempAttributes.value[k] - player.value.attributes[k];
                if (d > 0) diff[k] = d;
            }
            if (Object.keys(diff).length === 0) return;

            const success = await api.allocateAttributes(diff);
            if (success) emit('close');
        };

        // Format Buff Label Helper (Replicated/Imported logic)
        const getBuffTypeMultiplier = (type, value) => {
            // Mapping backend BuffType enums to stats
            // This is simplified. Ideally share config.
            // BuffType.PERCENT_ATK = "pct_atk"
            return value;
        };

        const projectedStats = computed(() => {
            if (!player.value) return {};
            const str = tempAttributes.value.str || 0;
            const agi = tempAttributes.value.agi || 0;
            const vit = tempAttributes.value.vit || 0;
            const ini = tempAttributes.value.ini || 0;

            // Base Stats (Backend Formulas)
            let hp = 50 + (vit * 5);
            let atk = 5 + (str * 2) + (agi * 1);
            let def = 0 + (vit * 1) + (agi * 1);
            let speed = 20.0 + (ini * 0.1);

            // Cooldown logic
            let cooldown = 1.5 - (ini * 0.05);
            if (cooldown < 0.3) cooldown = 0.3;

            // Multipliers from Awakenings
            let mult_hp = 1.0;
            let mult_atk = 1.0;
            let mult_def = 1.0;
            let mult_speed = 1.0;

            if (player.value.equipment) {
                Object.values(player.value.equipment).forEach(item => {
                    if (item) {
                        // Apply Enhancement Bonus (Compound)
                        // Assume 5% per level (Default)
                        // Note: Backend uses config. We approximate here.
                        let enh_mult = 1.0;
                        if (item.enhancement_level > 0) {
                            enh_mult = Math.pow(1.05, item.enhancement_level);
                        }

                        if (item.stats) {
                            hp += (item.stats.hp || 0) * enh_mult;
                            atk += (item.stats.atk || 0) * enh_mult;
                            def += (item.stats.def_ || 0) * enh_mult;
                            speed += (item.stats.speed || 0) * enh_mult;
                        }

                        // Accumulate Awakening Multipliers
                        if (item.awakenings) {
                            item.awakenings.forEach(buff => {
                                if (buff.type === 'pct_hp') mult_hp += buff.value;
                                if (buff.type === 'pct_atk') mult_atk += buff.value;
                                if (buff.type === 'pct_def') mult_def += buff.value;
                                if (buff.type === 'pct_speed') mult_speed += buff.value;
                            });
                        }
                    }
                });
            }

            // Apply Multipliers
            hp = hp * mult_hp;
            atk = atk * mult_atk;
            def = def * mult_def;
            speed = speed * mult_speed;

            return {
                hp: Math.floor(hp),
                atk: Math.floor(atk),
                def: Math.floor(def),
                speed: parseFloat(speed.toFixed(2)),
                cooldown: parseFloat(cooldown.toFixed(2))
            };
        });

        return {
            player,
            tempAttributes,
            availablePoints,
            hasChanges,
            adjustAttribute,
            confirmAttributes,
            projectedStats
        };
    }
};
