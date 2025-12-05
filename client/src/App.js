import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, logs, toasts, missions, inspectedPlayer } from './state.js';
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
        MissionTracker
    },
    template: `
    <div class="relative w-screen h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
            
            <!-- Fullscreen Map -->
            <GameMap v-if="player" />

            <!-- UI Overlay -->
            <div v-if="player" class="absolute inset-0 pointer-events-none flex flex-col justify-between">

                <!-- Navbar -->
                <div class="pointer-events-auto">
                    <Navbar 
                        @open-inventory="showInventory = true"
                        @open-attributes="showAttributes = true"
                        @open-rewards="showRewards = true"
                    />
                </div>

                <!-- Middle Section: Logs (Left Bottom) -->
                <div class="flex-1 relative">
                    <!-- Log Terminal -->
                    <div class="absolute bottom-24 left-4 w-96 h-48 bg-black/50 backdrop-blur-sm rounded p-2 overflow-y-auto pointer-events-auto font-mono text-xs space-y-1 border border-gray-700" ref="logContainer">
                        <div v-for="(log, index) in logs" :key="index" class="break-words">
                            <span class="text-gray-500">[{{ log.time }}]</span>
                            <span :class="log.color">{{ log.message }}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer / Hotbar -->
                <div class="pointer-events-auto">
                    <Hotbar @open-editor="showEditor = true" />
                </div>
            </div>

            <!-- Editor -->
            <WorldEditor v-if="showEditor" @close="showEditor = false" />

            <!-- Login Screen -->
            <div v-if="!player && !showEditor" class="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
                <div class="text-center bg-gray-800 p-8 rounded-lg border border-gray-700 shadow-2xl">
                    <h1 class="text-6xl font-bold text-yellow-500 mb-8">⚔️ Auto RPG</h1>
                    <div class="mb-4">
                        <input v-model="playerName" type="text" placeholder="Enter Hero Name"
                            class="bg-gray-700 text-white px-4 py-2 rounded text-xl w-full border border-gray-600 focus:border-blue-500 outline-none"
                            @keyup="checkCreatePlayer">
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
            <inventory-modal v-if="showInventory" @close="showInventory = false"></inventory-modal>
            <attributes-modal v-if="showAttributes" @close="showAttributes = false"></attributes-modal>
            <rewards-modal v-if="showRewards" @close="showRewards = false"></rewards-modal>
            <inspect-modal v-if="showInspect" :target="inspectedPlayer" @close="inspectedPlayer = null"></inspect-modal>
            
            <mission-tracker></mission-tracker>

            <!-- Death Modal -->
            <div v-if="isDead" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div class="bg-gray-900 border-2 border-red-600 p-8 rounded-lg text-center max-w-md w-full shadow-[0_0_50px_rgba(220,38,38,0.5)]">
                    <h2 class="text-4xl font-bold text-red-500 mb-4 tracking-wider">YOU DIED</h2>
                    <p class="text-gray-400 mb-6">Respawning at nearest Castle in...</p>

                    <div class="text-6xl font-mono text-white mb-8">{{ respawnTimer }}</div>

                    <button @click="instantRevive" class="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-4 rounded mb-3 flex items-center justify-center gap-2 transition-colors">
                        <span>💎</span> Revive Here (100 Gold)
                    </button>

                    <p class="text-xs text-gray-500 mt-4">Wait for timer to respawn at Save Point.</p>
                </div>
            </div>

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
        const showAttributes = ref(false);
        const showRewards = ref(false);
        const showEditor = ref(false);
        const logContainer = ref(null);
        const playerName = ref('');

        const createPlayer = async () => {
            if (!playerName.value) return;
            await api.createPlayer(playerName.value);
        };

        const checkCreatePlayer = (e) => {
            if (e.key === 'Enter') createPlayer();
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
            if (showEditor.value) return; // Disable game keys in editor

            if (e.key === 'e' || e.key === 'E') {
                showInventory.value = !showInventory.value;
            }
            if (e.key === 'p' || e.key === 'P') {
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
            }
        };

        onMounted(() => {
            const savedId = localStorage.getItem('rpg_player_id');
            if (savedId) {
                api.fetchPlayer(savedId);
            }
            // Load missions
            try {
                fetch('http://localhost:8000/missions').then(res => {
                    if (res.ok) return res.json();
                }).then(data => {
                    if (data) missions.value = data;
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
            if (dead) {
                respawnTimer.value = 10;
                respawnInterval = setInterval(() => {
                    respawnTimer.value--;
                    if (respawnTimer.value <= 0) {
                        clearInterval(respawnInterval);
                        api.respawnPlayer();
                    }
                }, 1000);
            } else {
                if (respawnInterval) clearInterval(respawnInterval);
            }
        });

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
            showInspect: computed(() => !!inspectedPlayer.value),
            inspectedPlayer,
            toasts,
            playerName,
            createPlayer,
            checkCreatePlayer,
            isDead,
            respawnTimer,
            instantRevive
        };
    }
};
