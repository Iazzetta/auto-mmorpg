import { ref, reactive, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export const player = ref(null);
export const logs = ref([]);
export const socket = ref(null);
export const currentMonster = ref(null);
export const mapMonsters = ref([]);
export const availableMissions = ref({});
export const isFreeFarming = ref(false);
export const selectedTargetId = ref('');
export const selectedMapId = ref('map_forest_1');
export const pendingAttackId = ref(null);
export const destinationMarker = ref(null);
export const toasts = ref([]);

// Computed
export const nextLevelXp = computed(() => player.value?.next_level_xp || 100);

// Helpers
export const addLog = (message, color = 'text-gray-300') => {
    if (logs.value.length > 0 && logs.value[0].message === message) return;
    logs.value.unshift({ time: new Date().toLocaleTimeString(), message, color, id: Date.now() });
    if (logs.value.length > 50) logs.value = logs.value.slice(0, 50);
};

let toastCounter = 0;
export const showToast = (icon, title, message, color = 'text-gray-300') => {
    const id = toastCounter++;
    toasts.value.push({ id, icon, title, message, color });
    setTimeout(() => {
        toasts.value = toasts.value.filter(toast => toast.id !== id);
    }, 5000);
};
