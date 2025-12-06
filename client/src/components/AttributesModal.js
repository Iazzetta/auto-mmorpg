import { ref, computed, watch } from 'vue';
import { player } from '../state.js';
import { api } from '../services/api.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" @click.self="$emit('close')">
            <div class="bg-gray-800 p-6 rounded-lg border border-gray-600 shadow-2xl max-w-sm w-full relative">
                <button @click="$emit('close')" class="absolute top-2 right-2 text-gray-400 hover:text-white">✕</button>
                <h3 class="text-xl font-bold mb-4 text-center">Attributes</h3>

                <div class="text-center mb-4">
                    <span class="text-gray-400">Points Available:</span>
                    <span class="text-yellow-400 font-bold text-xl ml-2">{{ availablePoints }}</span>
                </div>

                <div class="space-y-4 mb-6">
                    <div v-for="(val, attr) in tempAttributes" :key="attr"
                        class="bg-gray-700 p-3 rounded">
                        <div class="flex justify-between items-center mb-2">
                            <span class="uppercase font-bold w-12">{{ attr }}</span>
                            <span class="font-bold text-lg">{{ val }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button @click="adjustAttribute(attr, -1)"
                                class="w-8 h-8 bg-gray-600 rounded hover:bg-gray-500 font-bold text-xl leading-none pb-1">-</button>
                            
                            <input type="range" 
                                :min="player.attributes[attr]" 
                                :max="val + availablePoints" 
                                v-model.number="tempAttributes[attr]"
                                class="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500">
                                
                            <button @click="adjustAttribute(attr, 1)"
                                class="w-8 h-8 bg-green-600 rounded hover:bg-green-500 font-bold text-xl leading-none pb-1"
                                :disabled="availablePoints <= 0">+</button>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button @click="confirmAttributes"
                        class="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-white"
                        :disabled="!hasChanges">
                        Confirm
                    </button>
                </div>

                <!-- Projected Stats -->
                <div class="mt-4 border-t border-gray-600 pt-4" v-if="projectedStats && projectedStats.hp !== undefined">
                    <h4 class="font-bold text-gray-400 text-sm mb-2">Projected Stats</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="flex justify-between">
                            <span>HP:</span>
                            <span :class="projectedStats.hp > player.stats.max_hp ? 'text-green-400' : 'text-gray-300'">
                                {{ player.stats.max_hp }} <span v-if="projectedStats.hp > player.stats.max_hp">-> {{ projectedStats.hp }}</span>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>Atk:</span>
                            <span :class="projectedStats.atk > player.stats.atk ? 'text-green-400' : 'text-gray-300'">
                                {{ player.stats.atk }} <span v-if="projectedStats.atk > player.stats.atk">-> {{ projectedStats.atk }}</span>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>Def:</span>
                            <span :class="projectedStats.def > player.stats.def_ ? 'text-green-400' : 'text-gray-300'">
                                {{ player.stats.def_ }} <span v-if="projectedStats.def > player.stats.def_">-> {{ projectedStats.def }}</span>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>Speed:</span>
                            <span :class="projectedStats.speed > player.stats.speed ? 'text-green-400' : 'text-gray-300'">
                                {{ player.stats.speed }} <span v-if="projectedStats.speed > player.stats.speed">-> {{ projectedStats.speed }}</span>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>Cooldown:</span>
                            <span :class="projectedStats.cooldown < player.stats.attack_cooldown ? 'text-green-400' : 'text-gray-300'">
                                {{ player.stats.attack_cooldown }}s <span v-if="projectedStats.cooldown < player.stats.attack_cooldown">-> {{ projectedStats.cooldown }}s</span>
                            </span>
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

        const projectedStats = computed(() => {
            if (!player.value) return {};
            const str = tempAttributes.value.str || 0;
            const agi = tempAttributes.value.agi || 0;
            const vit = tempAttributes.value.vit || 0;
            const ini = tempAttributes.value.ini || 0;

            let hp = 100 + (vit * 10);
            let atk = 5 + (str * 2) + (agi * 1);
            let def = 0 + (vit * 1) + (agi * 1);
            let speed = 20.0 + (ini * 0.1);
            let cooldown = 1.5 - (ini * 0.05);
            if (cooldown < 0.3) cooldown = 0.3;

            if (player.value.equipment) {
                Object.values(player.value.equipment).forEach(item => {
                    if (item && item.stats) {
                        hp += (item.stats.hp || 0);
                        atk += (item.stats.atk || 0);
                        def += (item.stats.def_ || 0);
                        speed += (item.stats.speed || 0);
                    }
                });
            }

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
