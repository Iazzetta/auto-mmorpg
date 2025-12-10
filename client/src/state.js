import { ref, reactive, computed } from 'vue';

export const player = ref(null);
export const logs = ref([]);
export const chatMessages = ref([]);
export const socket = ref(null);
export const currentMonster = ref(null);
export const mapMonsters = ref([]);
export const mapPlayers = ref([]);
export const mapNpcs = ref([]);
export const inspectedPlayer = ref(null);
export const availableMissions = ref({});
export const isFreeFarming = ref(false);
export const selectedTargetId = ref('');
export const selectedTargetType = ref('monster'); // 'monster' | 'resource'
export const selectedMapId = ref('map_forest_1');
export const autoSellInferior = ref(localStorage.getItem('rpg_auto_sell') !== 'false');
export const pendingAttackId = ref(null);
export const destinationMarker = ref(null);

export const currentMapData = ref(null);
export const activeMission = ref(null);
export const missions = ref({});
export const worldData = ref(null);
export const isUpdating = ref(false);
export const isManuallyMoving = ref(false);
// Computed
export const nextLevelXp = computed(() => player.value?.next_level_xp || 100);

// Helpers
export const addLog = (message, color = 'text-gray-300') => {
    if (logs.value.length > 0 && logs.value[logs.value.length - 1].message === message) return;
    logs.value.push({ time: new Date().toLocaleTimeString(), message, color, id: Date.now() });
    if (logs.value.length > 50) logs.value.shift();
};

import { useGameAlerts } from './composables/useGameAlerts.js';

// Legacy exports (for backward compatibility if needed, but we should migrate)
export const toasts = ref([]);
export const gameAlerts = ref([]); // Kept to avoid breaking imports immediately, but effectively unused by new UI

// Shared Instance
const { addAlert, alerts } = useGameAlerts();
export { addAlert, alerts };

// Adapter for legacy showToast/showGameAlert calls to use new system immediately
export const showToast = (icon, title, message, color) => {
    // Map legacy toast to new alert
    // title is usually the main thing, message is subtext
    addAlert(title, 'success', icon, message);
};

export const showGameAlert = (message, type = 'info', icon = null) => {
    addAlert(message, type, icon);
};

