import { api } from '../services/api.js';

export default {
    props: ['isOpen'],
    emits: ['close'],
    template: `
        <div v-if="isOpen" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" @click.self="$emit('close')">
            <div class="bg-gray-800 p-6 rounded-lg border border-gray-600 shadow-2xl max-w-sm w-full relative">
                <button @click="$emit('close')" class="absolute top-2 right-2 text-gray-400 hover:text-white">✕</button>
                <h3 class="text-xl font-bold mb-4 text-center">Rewards</h3>
                
                <div class="space-y-4">
                    <div class="bg-gray-700 p-4 rounded border border-gray-600">
                        <h4 class="font-bold text-yellow-400 mb-2">Starter Chest</h4>
                        <p class="text-xs text-gray-300 mb-3">Get a head start with some essential items!</p>
                        <button @click="openChest"
                            class="w-full bg-yellow-600 hover:bg-yellow-500 py-2 rounded font-bold text-white shadow-lg">
                            🎁 Open Chest
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const openChest = async () => {
            await api.openChest();
        };
        return { openChest };
    }
};
