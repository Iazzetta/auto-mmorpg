import { ref, onMounted, onUnmounted, nextTick, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, logs, toasts, inspectedPlayer } from './state.js';
import { api } from './services/api.js';
import { toggleFreeFarm } from './services/autoFarm.js';

import GameMap from './components/GameMap.js';
import Navbar from './components/Navbar.js';
import Hotbar from './components/Hotbar.js';
import InventoryModal from './components/InventoryModal.js';
import MissionsModal from './components/MissionsModal.js';
import AttributesModal from './components/AttributesModal.js';
import RewardsModal from './components/RewardsModal.js';
import InspectModal from './components/InspectModal.js';

export default {
    components: {
        GameMap,
        Navbar,
        Hotbar,
        InventoryModal,
        MissionsModal,
        AttributesModal,
        RewardsModal,
        InspectModal
    },
    template: `
        <div class="relative w-screen h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
            
            <!-- Fullscreen Map -->
            <GameMap v-if="player" />

            <!-- UI Overlay (Pointer events none by default, auto for interactive elements) -->
            <div class="absolute inset-0 pointer-events-none flex flex-col justify-between">
                
                <!-- Navbar -->
                <div class="pointer-events-auto">
                    <Navbar 
                        @open-inventory="showInventory = true"
                        @open-missions="showMissions = true"
                        @open-attributes="showAttributes = true"
                        @open-rewards="showRewards = true"
                    />
                </div>

                <!-- Middle Section: Logs (Left Bottom) -->
                <div class="flex-1 relative">
                    <!-- Log Terminal -->
                    <div v-if="player" class="absolute bottom-24 left-4 w-96 h-48 bg-black/50 backdrop-blur-sm rounded p-2 overflow-y-auto pointer-events-auto font-mono text-xs space-y-1 border border-gray-700" ref="logContainer">
                        <div v-for="(log, index) in logs" :key="index" class="break-words">
                            <span class="text-gray-500">[{{ log.time }}]</span>
                            <span :class="log.color">{{ log.message }}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer / Hotbar -->
                <div class="pointer-events-auto">
                    <Hotbar v-if="player" />
                </div>
            </div>

            <!-- Login Screen -->
            <div v-if="!player" class="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
                <div class="text-center bg-gray-800 p-8 rounded-lg border border-gray-700 shadow-2xl">
                    <h1 class="text-6xl font-bold text-yellow-500 mb-8">⚔️ Auto RPG</h1>
                    <div class="mb-4">
                        <input v-model="playerName" type="text" placeholder="Enter Hero Name" 
                            class="bg-gray-700 text-white px-4 py-2 rounded text-xl w-full border border-gray-600 focus:border-blue-500 outline-none"
                            @keyup.enter="createPlayer">
                    </div>
                    <button @click="createPlayer" 
                        class="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded text-2xl font-bold text-white shadow-lg w-full transition-transform active:scale-95"
                        :disabled="!playerName">
                        Start Adventure
                    </button>
                    <div class="mt-4 text-gray-500 text-sm">Enter a unique name to start or resume.</div>
                </div>
            </div>

            <!-- Modals -->
            <InventoryModal :isOpen="showInventory" @close="showInventory = false" />
            <MissionsModal :isOpen="showMissions" @close="showMissions = false" />
            <AttributesModal :isOpen="showAttributes" @close="showAttributes = false" />
            <RewardsModal :isOpen="showRewards" @close="showRewards = false" />
            <InspectModal :isOpen="!!inspectedPlayer" :player="inspectedPlayer" @close="inspectedPlayer = null" />

            <!-- Toasts -->
            <div class="fixed bottom-24 right-4 flex flex-col gap-2 pointer-events-none z-50">
                <div v-for="toast in toasts" :key="toast.id"
                    class="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 animate-fade-in-up">
                    <span class="text-2xl">{{ toast.icon }}</span>
                    <div>
                        <div class="font-bold text-sm" :class="toast.color">{{ toast.title }}</div>
                        <div class="text-xs text-gray-400">{{ toast.message }}</div>
                    </div>
                </div>
            </div>

        </div>
    `,
    setup() {
        const showInventory = ref(false);
        const showMissions = ref(false);
        const showAttributes = ref(false);
        const showRewards = ref(false);
        const logContainer = ref(null);
        const playerName = ref('');

        const createPlayer = async () => {
            if (!playerName.value) return;
            await api.createPlayer(playerName.value);
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
            if (e.key === 'e' || e.key === 'E') {
                showInventory.value = !showInventory.value;
            }
            if (e.key === 'm' || e.key === 'M') {
                showMissions.value = !showMissions.value;
            }
            if (e.key === 'p' || e.key === 'P') {
                showAttributes.value = !showAttributes.value;
            }
            if (e.key === 'r' || e.key === 'R') {
                showRewards.value = !showRewards.value;
            }
            if (e.key === 'Escape') {
                showInventory.value = false;
                showMissions.value = false;
                showAttributes.value = false;
                showRewards.value = false;
                inspectedPlayer.value = null;
            }
            // Hotkeys 1-5
            if (['1', '2', '3', '4', '5'].includes(e.key)) {
                // Handled by Hotbar click usually, but we can map keys too
                // For now, let's leave it to click or add logic later
            }
        };

        onMounted(() => {
            const savedId = localStorage.getItem('rpg_player_id');
            if (savedId) {
                api.fetchPlayer(savedId);
            }
            window.addEventListener('keydown', handleKeydown);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeydown);
        });

        return {
            player,
            logs,
            toasts,
            createPlayer,
            showInventory,
            showMissions,
            showAttributes,
            showRewards,
            logContainer,
            playerName,
            inspectedPlayer
        };
    }
};
