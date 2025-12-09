import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../services/api.js';
import { player } from '../state.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" @click.self="$emit('close')">
            <div class="bg-gray-900/95 rounded-2xl border border-gray-700 shadow-2xl max-w-4xl w-full relative h-[600px] flex flex-col overflow-hidden">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h3 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">REWARDS</h3>
                        <p class="text-gray-400 text-xs">Claim your daily bonuses and level-up packs.</p>
                    </div>
                    <button @click="$emit('close')" class="text-gray-500 hover:text-white transition-colors text-2xl">✕</button>
                </div>

                <!-- Tabs -->
                <div class="flex border-b border-gray-800 bg-gray-900/30">
                    <button @click="activeTab = 'general'" 
                        class="flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all relative"
                        :class="activeTab === 'general' ? 'text-yellow-400 bg-yellow-400/5' : 'text-gray-500 hover:text-gray-300'">
                        Active Rewards
                        <div v-if="activeTab === 'general'" class="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                    </button>
                    <button @click="activeTab = 'level'" 
                        class="flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all relative"
                        :class="activeTab === 'level' ? 'text-purple-400 bg-purple-400/5' : 'text-gray-500 hover:text-gray-300'">
                        Level Up
                        <div v-if="activeTab === 'level'" class="absolute bottom-0 left-0 w-full h-0.5 bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.5)]"></div>
                    </button>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-6 bg-gray-900/20 custom-scrollbar">
                    
                    <!-- Loading -->
                    <div v-if="loading" class="flex justify-center items-center h-full text-gray-500 gap-2">
                        <span class="animate-spin">⏳</span> Loading rewards...
                    </div>

                    <!-- Grid -->
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="reward in filteredRewards" :key="reward.id" 
                            class="relative bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden group hover:border-gray-500/50 transition-all duration-300">
                            
                            <!-- Card Header / Icon -->
                            <div class="p-5 flex flex-col items-center justify-center bg-gradient-to-b from-gray-800/50 to-transparent border-b border-gray-700/30">
                                <div class="text-5xl mb-3 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-2xl">{{ reward.icon || '🎁' }}</div>
                                <h4 class="font-bold text-gray-100 text-lg">{{ reward.name }}</h4>
                                <div class="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold" 
                                     :class="getTypeColor(reward.type)">
                                    {{ reward.type.replace('_', ' ') }}
                                </div>
                            </div>

                            <!-- Description & Required -->
                            <div class="p-4 text-center">
                                <p class="text-xs text-gray-400 min-h-[2.5em]">{{ reward.description }}</p>

                                <!-- Rewards Preview -->
                                <div class="flex justify-center gap-2 mt-3 mb-2 flex-wrap">
                                    <span v-for="(item, idx) in reward.rewards.slice(0,3)" :key="idx" 
                                          class="bg-black/30 px-2 py-1 rounded text-[10px] text-gray-300 border border-gray-700/50">
                                          {{ item.item_id === 'gold' ? '💰' : item.item_id === 'diamonds' ? '💎' : '📦' }}
                                          x{{ item.quantity }}
                                    </span>
                                </div>
                            </div>

                            <!-- Footer / Action -->
                            <div class="p-4 pt-0">
                                <template v-if="getRewardStatus(reward).state === 'ready'">
                                    <button @click="claim(reward.id)" 
                                        class="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 py-3 rounded-lg font-bold text-white shadow-lg shadow-orange-900/20 transform active:scale-95 transition-all">
                                        Claim Reward
                                    </button>
                                </template>
                                
                                <template v-else-if="getRewardStatus(reward).state === 'cooldown'">
                                    <div class="w-full bg-gray-800/80 py-3 rounded-lg font-bold text-gray-500 text-center border border-gray-700 cursor-not-allowed">
                                        Wait {{ getRewardStatus(reward).timeLeft }}
                                    </div>
                                </template>

                                <template v-else-if="getRewardStatus(reward).state === 'locked'">
                                    <div class="w-full bg-gray-800/80 py-3 rounded-lg font-bold text-red-400 text-center border border-red-900/30 cursor-not-allowed">
                                        Requires Lvl {{ reward.requirements.level }}
                                    </div>
                                </template>

                                <template v-else-if="getRewardStatus(reward).state === 'claimed'">
                                    <div class="w-full bg-green-900/20 py-3 rounded-lg font-bold text-green-500 text-center border border-green-900/30 flex items-center justify-center gap-2">
                                        <span>✔</span> Claimed
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup(props) {
        const activeTab = ref('general');
        const rewards = ref([]);
        const loading = ref(false);

        const fetchRewards = async () => {
            loading.value = true;
            rewards.value = await api.getRewards();
            loading.value = false;
        };

        onMounted(() => {
            if (props.isOpen) fetchRewards();
        });

        watch(() => props.isOpen, (newVal) => {
            if (newVal) fetchRewards();
        });

        const filteredRewards = computed(() => {
            if (activeTab.value === 'general') {
                return rewards.value.filter(r => ['daily', 'weekly', 'one_time'].includes(r.type));
            } else {
                return rewards.value.filter(r => r.type === 'level');
            }
        });

        const getRewardStatus = (reward) => {
            if (!player.value) return { state: 'locked' };

            // Start with Locked Check
            const reqLvl = reward.requirements?.level || 0;
            if (player.value.level < reqLvl) return { state: 'locked' };

            const claimedData = player.value.claimed_rewards || {};
            const lastClaim = claimedData[reward.id] || 0;
            const now = Date.now() / 1000; // js uses ms, py uses s. backend sends seconds usually?
            // Backend sends time.time(), which is seconds. JS Date.now() is ms.
            // Let's assume we need to convert JS time to seconds for comparison.

            if (reward.type === 'one_time' || reward.type === 'level') {
                if (lastClaim > 0) return { state: 'claimed' };
                return { state: 'ready' };
            }

            if (reward.type === 'daily') {
                const diff = now - lastClaim;
                if (diff < 86400) {
                    const hours = Math.ceil((86400 - diff) / 3600);
                    return { state: 'cooldown', timeLeft: `${hours}h` };
                }
                return { state: 'ready' };
            }

            if (reward.type === 'weekly') {
                const diff = now - lastClaim;
                if (diff < 604800) {
                    const days = Math.ceil((604800 - diff) / 86400);
                    return { state: 'cooldown', timeLeft: `${days}d` };
                }
                return { state: 'ready' };
            }

            return { state: 'ready' };
        };

        const claim = async (id) => {
            const success = await api.claimReward(id);
            if (success) {
                // Refresh rewards/player is done inside api.claimReward usually
            }
        };

        const getTypeColor = (type) => {
            switch (type) {
                case 'daily': return 'text-blue-400';
                case 'weekly': return 'text-purple-400';
                case 'one_time': return 'text-yellow-400';
                case 'level': return 'text-green-400';
                default: return 'text-gray-400';
            }
        };

        return {
            activeTab,
            filteredRewards,
            loading,
            getRewardStatus,
            claim,
            getTypeColor
        };
    }
};
