import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';
import { player, logs, chatMessages, isFreeFarming, toasts, missions, inspectedPlayer, worldData, isUpdating } from './state.js';
import { api } from './services/api.js';
import { toggleFreeFarm } from './services/autoFarm.js';

import GameMap from './components/GameMap.js';
import Navbar from './components/Navbar.js';
import Hotbar from './components/Hotbar.js';
import InventoryModal from './components/InventoryModal.js';
import AttributesModal from './components/AttributesModal.js';
import RewardsModal from './components/RewardsModal.js';
import InspectModal from './components/InspectModal.js';
import WorldEditor from './components/WorldEditor.js';
import MissionTracker from './components/MissionTracker.js';
import GameAlerts from './components/GameAlerts.js';
import NpcInteraction from './components/NpcInteraction.js';

export default {
    components: {
        GameMap,
        Navbar,
        Hotbar,
        InventoryModal,
        AttributesModal,
        RewardsModal,
        InspectModal,
        WorldEditor,
        MissionTracker,
        GameAlerts,
        NpcInteraction
    },
    template: `
    <div class="relative w-screen h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
            
            <!-- Fullscreen Map -->
            <GameMap v-if="player" @interact-npc="handleNpcInteraction" />

            <!-- UI Overlay -->
            <div v-if="player" class="absolute inset-0 pointer-events-none flex flex-col justify-between z-40">

                <!-- Navbar -->
                <div class="pointer-events-auto">
                    <Navbar 
                        @open-inventory="showInventory = true"
                        @open-attributes="showAttributes = true"
                        @open-rewards="showRewards = true"
                    />
                </div>

                <!-- Middle Section: Chat/Logs -->
                <div class="flex-1 relative pointer-events-none">
                    <div class="absolute bottom-2 left-4 w-80 h-48 bg-black/60 backdrop-blur-md rounded border border-gray-700 pointer-events-auto flex flex-col shadow-xl transition-all duration-300"
                         :class="{'opacity-100': isChatFocused || isHoveringChat, 'opacity-70': !isChatFocused && !isHoveringChat}"
                         @mouseenter="isHoveringChat = true"
                         @mouseleave="isHoveringChat = false">
                        <!-- Tabs -->
                        <div class="flex border-b border-gray-700 bg-black/40">
                            <button @click="activeTab = 'chat'" class="flex-1 py-1 text-xs font-bold uppercase transition-colors" :class="activeTab === 'chat' ? 'text-blue-400 bg-white/10' : 'text-gray-500 hover:text-gray-300'">Chat</button>
                            <button @click="activeTab = 'system'" class="flex-1 py-1 text-xs font-bold uppercase transition-colors" :class="activeTab === 'system' ? 'text-yellow-400 bg-white/10' : 'text-gray-500 hover:text-gray-300'">System</button>
                        </div>

                        <!-- Chat Content -->
                        <div v-if="activeTab === 'chat'" class="flex-1 flex flex-col min-h-0">
                             <div class="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs" ref="chatContainer">
                                 <div v-for="msg in chatMessages" :key="msg.id" class="break-words leading-tight">
                                     <span class="text-gray-500">[{{ msg.time }}]</span>
                                     <span :class="msg.isPlayer ? 'text-green-400' : 'text-blue-300'" class="font-bold ml-1">{{ msg.name }}:</span>
                                     <span class="text-gray-200 ml-1">{{ msg.message }}</span>
                                 </div>
                             </div>
                             <input ref="chatInputRef"
                                    v-model="chatInput"
                                    @focus="isChatFocused = true"
                                    @blur="isChatFocused = false" 
                                    @keydown.enter.stop="handleChatEnter"
                                    placeholder="Press Enter to chat..." 
                                    class="bg-black/50 border-t border-gray-700 p-2 text-xs text-white outline-none focus:bg-black/80 transition-colors w-full"
                             >
                        </div>

                         <!-- System Logs -->
                         <div v-show="activeTab === 'system'" class="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs" ref="logContainer">
                            <div v-for="(log, index) in logs" :key="index" class="break-words">
                                <span class="text-gray-500">[{{ log.time }}]</span>
                                <span :class="log.color">{{ log.message }}</span>
                            </div>
                         </div>
                    </div>
                </div>

                <!-- Footer / Hotbar -->
                <div class="pointer-events-auto">
                    <Hotbar @open-editor="showEditor = true">
                        <button @click="toggleFreeFarm" 
                                class="w-12 h-12 bg-black/80 border-2 rounded flex items-center justify-center text-2xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95 ml-2"
                                :class="isFreeFarming ? 'border-red-500 text-red-500' : 'border-green-500 text-green-500'"
                                :title="isFreeFarming ? 'Stop Auto Attack' : 'Start Auto Attack'">
                            {{ isFreeFarming ? '❌' : '⚔️' }}
                        </button>
                    </Hotbar>
                </div>
            </div>

            <!-- Editor -->
            <WorldEditor v-if="showEditor" @close="showEditor = false" />
            
            <!-- NPC Interaction -->
            <NpcInteraction v-if="showNpcInteraction && activeNpc" :npc="activeNpc" @close="closeNpcInteraction" />

            <!-- Login/Register Screen -->
            <div v-if="!player && !showEditor" class="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
                <div class="text-center bg-gray-800 p-8 rounded-lg border border-gray-700 shadow-2xl w-96">
                    <h1 class="text-4xl font-bold text-yellow-500 mb-8">⚔️ Auto RPG</h1>
                    
                    <div class="flex gap-2 mb-6 bg-gray-700 p-1 rounded">
                        <button @click="isLoginMode = true" class="flex-1 py-1 rounded transition-colors" :class="isLoginMode ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'">Login</button>
                        <button @click="isLoginMode = false" class="flex-1 py-1 rounded transition-colors" :class="!isLoginMode ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'">Register</button>
                    </div>

                    <div class="mb-4 text-left">
                        <label class="text-xs text-gray-400 block mb-1">Username</label>
                        <input v-model="playerName" type="text" placeholder="Hero Name"
                            class="bg-gray-700 text-white px-3 py-2 rounded w-full border border-gray-600 focus:border-blue-500 outline-none">
                    </div>

                    <div class="mb-6 text-left">
                        <label class="text-xs text-gray-400 block mb-1">Password</label>
                        <input v-model="password" type="password" placeholder="Secret Password"
                            class="bg-gray-700 text-white px-3 py-2 rounded w-full border border-gray-600 focus:border-blue-500 outline-none"
                            @keyup.enter="handleAuth">
                    </div>

                    <button @click="handleAuth"
                        class="w-full py-3 rounded text-xl font-bold text-white shadow-lg transition-transform active:scale-95"
                        :class="isLoginMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'"
                        :disabled="!playerName || !password">
                        {{ isLoginMode ? 'Enter World' : 'Create Hero' }}
                    </button>
                </div>
            </div>

            <!-- Modals -->
            <inventory-modal v-if="showInventory" :is-open="true" @close="showInventory = false"></inventory-modal>
            <attributes-modal v-if="showAttributes" :is-open="true" @close="showAttributes = false"></attributes-modal>
            <rewards-modal v-if="showRewards" :is-open="true" @close="showRewards = false"></rewards-modal>
            <inspect-modal v-if="showInspect" :target="inspectedPlayer" :is-open="true" @close="inspectedPlayer = null"></inspect-modal>
            
            <mission-tracker></mission-tracker>
            <game-alerts></game-alerts>

            <!-- Death Modal -->
            <div v-if="isDead" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div class="bg-gray-900 border-2 border-red-600 p-8 rounded-lg text-center max-w-md w-full shadow-[0_0_50px_rgba(220,38,38,0.5)]">
                    <h2 class="text-4xl font-bold text-red-500 mb-4 tracking-wider">YOU DIED</h2>
                    <p class="text-gray-400 mb-6">Respawning at nearest Castle in...</p>

                    <div class="text-6xl font-mono text-white mb-8">{{ respawnTimer }}</div>

                    <button @click="instantRevive" class="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-4 rounded mb-3 flex items-center justify-center gap-2 transition-colors">
                        <span>💎</span> Revive Here (1 Diamond)
                    </button>

                    <p class="text-xs text-gray-500 mt-4">Wait for timer to respawn at Save Point.</p>
                </div>
            </div>



            <!-- Server Updating Modal -->
            <div v-if="isUpdating" class="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100]">
                <div class="text-6xl animate-spin mb-4">⚙️</div>
                <h2 class="text-2xl font-bold text-yellow-500 mb-2">Server Updating</h2>
                <p class="text-gray-400">Applying changes to the world...</p>
            </div>

    </div>
    `,
    setup() {
        const showInventory = ref(false);
        const showAttributes = ref(false);
        const showRewards = ref(false);
        const showEditor = ref(false);
        const showNpcInteraction = ref(false);
        const activeNpc = ref(null);
        const logContainer = ref(null);
        const playerName = ref('');
        const password = ref('');
        const isLoginMode = ref(true);

        // Chat
        const activeTab = ref('chat');
        const chatInput = ref('');
        const chatInputRef = ref(null);
        const chatContainer = ref(null);
        const isHoveringChat = ref(false);
        const isChatFocused = ref(false);

        watch(chatMessages, () => {
            nextTick(() => {
                if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
            });
        }, { deep: true });

        const handleChatEnter = (e) => {
            if (chatInput.value.trim()) {
                api.sendMessage(chatInput.value.trim());
                chatInput.value = '';
            }
            chatInputRef.value.blur();
        };

        const handleAuth = async () => {
            if (!playerName.value || !password.value) return;

            if (isLoginMode.value) {
                await api.login(playerName.value, password.value);
            } else {
                await api.register(playerName.value, password.value);
            }
        };

        const handleNpcInteraction = (npc) => {
            activeNpc.value = npc;
            showNpcInteraction.value = true;
        };

        const closeNpcInteraction = () => {
            showNpcInteraction.value = false;
            activeNpc.value = null;
        };

        // Auto-scroll logs
        watch(logs, () => {
            nextTick(() => {
                if (logContainer.value) {
                    logContainer.value.scrollTop = logContainer.value.scrollHeight;
                }
            });
        }, { deep: true });

        // Key Bindings
        const handleKeydown = (e) => {
            if (!player.value) return;
            if (showEditor.value || showNpcInteraction.value) return; // Disable game keys in editor/dialog

            if (e.key === 'b' || e.key === 'B') {
                showInventory.value = !showInventory.value;
            }
            if (e.key === 'c' || e.key === 'C') {
                showAttributes.value = !showAttributes.value;
            }
            if (e.key === 'r' || e.key === 'R') {
                showRewards.value = !showRewards.value;
            }
            if (e.key === 'Escape') {
                showInventory.value = false;
                showAttributes.value = false;
                showRewards.value = false;
                inspectedPlayer.value = null;
                // Also blur chat
                if (chatInputRef.value) chatInputRef.value.blur();
            }

            if (e.key === 'Enter') {
                if (document.activeElement !== chatInputRef.value) {
                    e.preventDefault();
                    if (chatInputRef.value) chatInputRef.value.focus();
                }
            }
        };

        onMounted(() => {
            const savedId = localStorage.getItem('rpg_player_id');
            if (savedId) {
                api.fetchPlayer(savedId);
            }
            // Load missions
            try {
                fetch('http://localhost:8000/content/missions').then(res => {
                    if (res.ok) return res.json();
                }).then(data => {
                    if (data) missions.value = data;
                });

                // Load World Data for Navigation
                fetch('http://localhost:8000/editor/world').then(res => {
                    if (res.ok) return res.json();
                }).then(data => {
                    if (data) worldData.value = data;
                });
            } catch (e) { console.error(e); }

            window.addEventListener('keydown', handleKeydown);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeydown);
        });

        const isDead = computed(() => player.value && player.value.stats.hp <= 0);
        const respawnTimer = ref(10);
        let respawnInterval = null;

        watch(isDead, (dead) => {
            if (respawnInterval) clearInterval(respawnInterval);

            if (dead) {
                const updateTimer = () => {
                    if (!player.value) return;

                    // If no death_time from server (legacy or error), default to 10s local countdown
                    if (!player.value.death_time) {
                        if (respawnTimer.value > 0) respawnTimer.value--;
                        else {
                            clearInterval(respawnInterval);
                            api.respawnPlayer();
                        }
                        return;
                    }

                    const now = Date.now() / 1000;
                    const elapsed = now - player.value.death_time;
                    const remaining = Math.max(0, 10 - Math.floor(elapsed));
                    respawnTimer.value = remaining;

                    if (remaining <= 0) {
                        clearInterval(respawnInterval);
                        api.respawnPlayer();
                    }
                };

                // Initial check
                if (player.value && player.value.death_time) {
                    const now = Date.now() / 1000;
                    const elapsed = now - player.value.death_time;
                    respawnTimer.value = Math.max(0, 10 - Math.floor(elapsed));
                } else {
                    respawnTimer.value = 10;
                }

                respawnInterval = setInterval(updateTimer, 1000);
            }
        }, { immediate: true });

        const instantRevive = async () => {
            await api.revivePlayer();
        };

        return {
            player,
            logs,
            logContainer,
            showInventory,
            showAttributes,
            showRewards,
            showEditor,
            showNpcInteraction,
            activeNpc,
            handleNpcInteraction,
            closeNpcInteraction,
            showInspect: computed(() => !!inspectedPlayer.value),
            inspectedPlayer,
            toasts,
            playerName,
            password,
            isLoginMode,
            handleAuth,
            isDead,
            respawnTimer,
            instantRevive,
            instantRevive,
            isUpdating,
            activeTab,
            chatInput,
            chatMessages,
            chatInputRef,
            chatContainer,
            handleChatEnter,
            isFreeFarming,
            toggleFreeFarm,
            isHoveringChat,
            isChatFocused
        };
    }
};
