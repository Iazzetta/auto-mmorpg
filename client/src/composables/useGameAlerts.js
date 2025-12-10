import { ref } from 'vue';

const alerts = ref([]);
const queue = [];
let alertId = 0;
let isProcessing = false;

export function useGameAlerts() {

    /**
     * @param {string} message - Main text (e.g., "Iron Ore")
     * @param {string} type - 'drop', 'gold', 'exp', 'success', 'warning', 'error'
     * @param {string} icon - Optional emoji or icon char
     * @param {string} subtext - Optional detail (e.g., "Gathered")
     * @param {string} rarity - Optional rarity for color coding ('common', 'rare', etc.)
     */
    const addAlert = (message, type = 'drop', icon = null, subtext = '', rarity = 'common') => {
        const id = ++alertId;

        // Auto-assign icons if missing
        if (!icon) {
            if (type === 'gold') icon = '💰';
            if (type === 'exp') icon = '✨';
            if (type === 'success') icon = '✅';
            if (type === 'warning') icon = '⚠️';
            if (type === 'error') icon = '❌';
            if (type === 'drop') icon = '🎁';
        }

        // Push to queue instead of direct display
        queue.push({
            id,
            message,
            type,
            icon,
            subtext: subtext === 'undefined' ? '' : subtext, // Sanity check
            rarity,
            timestamp: Date.now()
        });

        processQueue();
    };

    const processQueue = () => {
        if (isProcessing || queue.length === 0) return;

        isProcessing = true;

        // Process next item
        const nextAlert = queue.shift();

        // Add to visible alerts
        alerts.value.push(nextAlert);

        // Limit history (Strictly 3 for UI)
        if (alerts.value.length > 3) {
            alerts.value.shift();
        }

        // Auto remove this specific alert after N seconds
        // Faster duration (2.5s) to clear screen quicker
        setTimeout(() => {
            removeAlert(nextAlert.id);
        }, 2500);

        // Schedule next processing after delay
        // Super fast (80ms) for "streaming" feel
        setTimeout(() => {
            isProcessing = false;
            if (queue.length > 0) {
                processQueue();
            }
        }, 80);
    };

    const removeAlert = (id) => {
        const index = alerts.value.findIndex(a => a.id === id);
        if (index !== -1) {
            alerts.value.splice(index, 1);
        }
    };

    return {
        alerts,
        addAlert,
        removeAlert
    };
}
