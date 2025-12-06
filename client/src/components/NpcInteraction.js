import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../services/api.js';
import { player, showToast } from '../state.js';

export default {
    props: ['npc'],
    emits: ['close'],
    template: `
        <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center font-mono text-white p-4">
            <div class="bg-gray-900 border-2 border-yellow-600 rounded-lg w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                
                <!-- Header -->
                <div class="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
                    <h2 class="text-2xl font-bold text-yellow-500">{{ npc.name }}</h2>
                    <button @click="$emit('close')" class="text-gray-400 hover:text-white">✕ (ESC)</button>
                </div>

                <!-- Content -->
                <div class="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
                    
                    <!-- Dialogue Mode -->
                    <div v-if="mode === 'dialogue'" class="flex flex-col gap-4">
                        <div class="text-lg leading-relaxed text-gray-200 bg-black/30 p-4 rounded border border-gray-700">
                            "{{ currentLine }}"
                        </div>
                        
                        <div class="flex justify-end gap-2 mt-4">
                            <button v-if="hasNextLine" @click="nextLine" class="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold animate-pulse">
                                Next (F)
                            </button>
                            <button v-else-if="npc.type === 'quest_giver' && npc.quest_id" @click="offerQuest" class="bg-yellow-600 hover:bg-yellow-500 px-6 py-2 rounded font-bold">
                                Discuss Quest
                            </button>
                            <button v-else-if="npc.type === 'merchant'" @click="openShop" class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-bold">
                                Show Wares
                            </button>
                            <button v-else @click="$emit('close')" class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded font-bold">
                                Goodbye
                            </button>
                        </div>
                    </div>

                    <!-- Quest Offer Mode -->
                    <div v-if="mode === 'quest_offer'" class="flex flex-col gap-4">
                        <h3 class="text-xl font-bold text-yellow-400">Quest Available</h3>
                        <p class="text-gray-300">I have a task for you, adventurer.</p>
                        
                        <div class="flex gap-4 mt-4">
                            <button @click="acceptQuest" class="flex-1 bg-yellow-600 hover:bg-yellow-500 py-3 rounded font-bold text-black">
                                Accept Quest
                            </button>
                            <button @click="$emit('close')" class="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded font-bold">
                                Decline
                            </button>
                        </div>
                    </div>

                    <!-- Shop Mode -->
                    <div v-if="mode === 'shop'" class="flex flex-col gap-4 h-full">
                        <div class="flex justify-between items-center bg-black/50 p-2 rounded">
                            <span class="text-yellow-400 font-bold">Your Gold: {{ player.gold }} 💰</span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 overflow-y-auto pr-2">
                            <div v-for="itemId in npc.shop_items" :key="itemId" class="bg-black/40 p-3 rounded border border-gray-700 flex justify-between items-center hover:bg-gray-800 transition-colors">
                                <div class="flex items-center gap-3">
                                    <div class="text-2xl">{{ getItemIcon(itemId) }}</div>
                                    <div class="flex flex-col">
                                        <span class="font-bold text-sm">{{ getItemName(itemId) }}</span>
                                        <span class="text-xs text-yellow-500">Price: {{ getItemPrice(itemId) }} G</span>
                                    </div>
                                </div>
                                <button @click="buyItem(itemId)" class="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs font-bold">
                                    Buy
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const mode = ref('dialogue'); // dialogue, quest_offer, shop
        const dialogueIndex = ref(0);
        const shopItemsDetails = ref({}); // To store fetched item details

        const currentLine = computed(() => {
            if (!props.npc.dialogue || props.npc.dialogue.length === 0) return "...";
            return props.npc.dialogue[dialogueIndex.value];
        });

        const hasNextLine = computed(() => {
            return props.npc.dialogue && dialogueIndex.value < props.npc.dialogue.length - 1;
        });

        const nextLine = () => {
            if (hasNextLine.value) dialogueIndex.value++;
        };

        const offerQuest = () => {
            mode.value = 'quest_offer';
        };

        const acceptQuest = async () => {
            try {
                // Actually, let's fix the fetch call to pass action as query param
                const res2 = await fetch(`http://localhost:8000/player/${player.value.id}/npc/${props.npc.id}/action?action=accept_quest`, {
                    method: 'POST'
                });

                if (res2.ok) {
                    const data = await res2.json();
                    alert(data.message);
                    emit('close');
                } else {
                    alert("Failed to accept quest.");
                }
            } catch (e) { console.error(e); }
        };

        const openShop = async () => {
            mode.value = 'shop';
            try {
                const res = await fetch('http://localhost:8000/editor/items');
                if (res.ok) {
                    shopItemsDetails.value = await res.json();
                }
            } catch (e) { console.error(e); }
        };

        const getItemName = (id) => shopItemsDetails.value[id]?.name || id;
        const getItemIcon = (id) => shopItemsDetails.value[id]?.icon || '📦';
        const getItemPrice = (id) => {
            const item = shopItemsDetails.value[id];
            if (!item) return "???";
            if (item.stats.hp > 0) return 50;
            return Math.max(10, (item.power_score || 0) * 10);
        };

        const buyItem = async (itemId) => {
            try {
                const res = await fetch(`http://localhost:8000/player/${player.value.id}/shop/buy?npc_id=${props.npc.id}&item_id=${itemId}`, {
                    method: 'POST'
                });
                if (res.ok) {
                    const data = await res.json();
                    // Update player gold/inventory locally or wait for sync
                    player.value.gold = data.gold;
                    player.value.inventory = data.inventory;
                    showToast('💰', 'Item Purchased', `You bought ${getItemName(itemId)}`, 'text-yellow-400');
                } else {
                    const err = await res.json();
                    showToast('❌', 'Error', err.detail || "Failed to buy.", 'text-red-400');
                }
            } catch (e) { console.error(e); }
        };

        const handleKey = (e) => {
            if (e.key === 'Escape') emit('close');
            if (e.key === 'f' || e.key === 'F') {
                if (mode.value === 'dialogue') {
                    if (hasNextLine.value) nextLine();
                    else {
                        if (props.npc.type === 'quest_giver') offerQuest();
                        else if (props.npc.type === 'merchant') openShop();
                        else emit('close');
                    }
                }
            }
        };

        onMounted(() => {
            window.addEventListener('keydown', handleKey);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKey);
        });

        return {
            mode,
            currentLine,
            hasNextLine,
            nextLine,
            offerQuest,
            acceptQuest,
            openShop,
            buyItem,
            player,
            getItemName,
            getItemIcon,
            getItemPrice
        };
    }
};
