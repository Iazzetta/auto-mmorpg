import { ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { gameAlerts } from '../state.js';

export default {
    template: `
    <div class="fixed top-20 left-1/2 transform -translate-x-1/2 flex flex-col gap-1 z-[100] pointer-events-none w-full max-w-xs items-center">
        <div v-for="alert in gameAlerts" :key="alert.id"
             class="px-2 py-1 rounded shadow-sm border backdrop-blur-md animate-bounce-in flex items-center gap-2 min-w-[140px] justify-center"
             :class="getAlertClass(alert.type)">
             
             <span class="text-sm">{{ alert.icon || getIcon(alert.type) }}</span>
             <span class="font-bold text-[10px] text-shadow-sm">{{ alert.message }}</span>
        </div>
    </div>
    `,
    setup() {
        const getAlertClass = (type) => {
            switch (type) {
                case 'error': return 'bg-red-900/80 border-red-500 text-red-100';
                case 'warning': return 'bg-yellow-900/80 border-yellow-500 text-yellow-100';
                case 'success': return 'bg-green-900/80 border-green-500 text-green-100';
                case 'drop': return 'bg-purple-900/80 border-purple-500 text-purple-100';
                case 'levelup': return 'bg-yellow-600/90 border-yellow-300 text-white shadow-[0_0_20px_rgba(250,204,21,0.5)]';
                default: return 'bg-gray-800/80 border-gray-500 text-white';
            }
        };

        const getIcon = (type) => {
            switch (type) {
                case 'error': return '🚫';
                case 'warning': return '⚠️';
                case 'success': return '✅';
                case 'drop': return '🎁';
                case 'levelup': return '🆙';
                default: return 'ℹ️';
            }
        };

        return {
            gameAlerts,
            getAlertClass,
            getIcon
        };
    }
};
