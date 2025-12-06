import { ref, reactive, computed } from 'vue';

export const player = ref(null);
export const logs = ref([]);
export const socket = ref(null);
export const currentMonster = ref(null);
export const mapMonsters = ref([]);
export const mapPlayers = ref([]);
export const mapNpcs = ref([]);
export const inspectedPlayer = ref(null);
export const availableMissions = ref({});
export const isFreeFarming = ref(false);
export const selectedTargetId = ref('');
export const selectedMapId = ref('map_forest_1');
export const autoSellInferior = ref(localStorage.getItem('rpg_auto_sell') !== 'false');
export const pendingAttackId = ref(null);
export const destinationMarker = ref(null);
export const toasts = ref([]);
export const currentMapData = ref(null);
export const activeMission = ref(null);
export const missions = ref({});
export const worldData = ref(null);
export const isUpdating = ref(false);
// Computed
export const nextLevelXp = computed(() => player.value?.next_level_xp || 100);

// Helpers
export const addLog = (message, color = 'text-gray-300') => {
    if (logs.value.length > 0 && logs.value[logs.value.length - 1].message === message) return;
    logs.value.push({ time: new Date().toLocaleTimeString(), message, color, id: Date.now() });
    if (logs.value.length > 50) logs.value.shift();
};

let toastCounter = 0;
export const showToast = (icon, title, message, color = 'text-gray-300') => {
    const id = toastCounter++;
    toasts.value.push({ id, icon, title, message, color });
    setTimeout(() => {
        toasts.value = toasts.value.filter(toast => toast.id !== id);
    }, 5000);
};
export const gameAlerts = ref([]);
let alertCounter = 0;
export const showGameAlert = (message, type = 'info', icon = null) => {
    const id = alertCounter++;
    // Types: info, success, warning, error, drop, levelup
    gameAlerts.value.push({ id, message, type, icon });
    if (gameAlerts.value.length > 4) gameAlerts.value.shift();
    setTimeout(() => {
        gameAlerts.value = gameAlerts.value.filter(a => a.id !== id);
    }, 4000);
};
