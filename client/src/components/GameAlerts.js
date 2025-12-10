import { ref, computed } from 'vue';
import { alerts } from '../state.js';

export default {
    template: `
    <div class="fixed top-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-50 w-auto pointer-events-none gap-1">
        <component :is="'style'">
            .alert-scale-leave-active { position: absolute; opacity: 0 !important; transition: none !important; }
        </component>
        <transition-group name="alert-scale" tag="div" class="flex flex-col items-center">
            <div v-for="(alert, index) in activeAlerts" :key="alert.id"
                 class="relative flex items-center gap-2 px-3 py-1 rounded bg-gray-900/90 border shadow-lg backdrop-blur-sm transition-all duration-500 ease-out"
                 :class="getAlertClass(alert.type, alert.rarity)"
                 :style="getStackStyle(index, activeAlerts.length)">
                 
                 <!-- Content -->
                 <span class="text-lg leading-none filter drop-shadow">{{ alert.icon }}</span>
                 <div class="flex flex-col min-w-[100px]">
                     <span class="font-bold text-[10px] uppercase leading-none text-shadow-sm flex items-center gap-1">
                        {{ alert.message }}
                        <span v-if="alert.subtext" class="text-[9px] bg-white/20 px-1 rounded-sm ml-1 text-white font-mono tracking-tight">{{ alert.subtext }}</span>
                     </span>
                 </div>
            </div>
        </transition-group>
    </div>
    `,
    setup() {
        // Show max 3 alerts
        const activeAlerts = computed(() => {
            return alerts.value.slice(-3);
        });

        const getStackStyle = (index, total) => {
            // index 0 = Oldest (Top of list)
            // index total-1 = Newest (Bottom of list)

            // We want Newest to be Scale 1, Opacity 1.
            // Oldest to be Scale 0.8, Opacity 0.5.

            // Reverse index: Newest=0, Oldest=Total-1
            const revIndex = (total - 1) - index;

            // Hardcoded steps for max 3 items
            // Newest (revIndex 0): Scale 1.0, Opacity 1.0
            // Middle (revIndex 1): Scale 0.9, Opacity 0.7
            // Oldest (revIndex 2): Scale 0.8, Opacity 0.4

            const scale = 1 - (revIndex * 0.15);
            const opacity = 1 - (revIndex * 0.4);
            const yOffset = revIndex * -2; // Slight overlap upwards

            return {
                transform: `scale(${scale}) translateY(${yOffset}px)`,
                opacity: opacity,
                zIndex: 100 - revIndex
            };
        };

        const getAlertClass = (type, rarity) => {
            let base = "border-l-2 text-white";

            // Simplified high-contrast tiny borders
            if (rarity && rarity !== 'common') {
                switch (rarity) {
                    case 'uncommon': return `${base} border-green-500`;
                    case 'rare': return `${base} border-blue-500`;
                    case 'epic': return `${base} border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]`;
                    case 'legendary': return `${base} border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]`;
                }
            }

            switch (type) {
                case 'error': return `${base} border-red-500`;
                case 'warning': return `${base} border-orange-500`;
                case 'success': return `${base} border-green-500`;
                case 'gold': return `${base} border-yellow-500`;
                case 'exp': return `${base} border-blue-400`;
                case 'levelup': return `${base} border-yellow-400 font-black tracking-widest`;
                default: return `${base} border-gray-500`;
            }
        };

        return {
            activeAlerts,
            getStackStyle,
            getAlertClass
        };
    }
};

