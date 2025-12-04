import { ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { api } from '../services/api.js';

export default {
    template: `
        <div class="fixed inset-0 bg-gray-900 text-white z-50 overflow-auto">
            <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                <h1 class="text-2xl font-bold text-yellow-500">Map Editor</h1>
                <div class="flex gap-2">
                    <button @click="saveWorld" class="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold">Save World</button>
                    <button @click="$emit('close')" class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold">Close</button>
                </div>
            </div>

            <div class="flex h-[calc(100vh-80px)]">
                <!-- Sidebar -->
                <div class="w-64 bg-gray-800 p-4 border-r border-gray-700 overflow-y-auto">
                    <h2 class="font-bold mb-2 text-gray-400">Maps</h2>
                    <ul class="space-y-1 mb-4">
                        <li v-for="(map, id) in worldData.maps" :key="id" 
                            class="p-2 rounded cursor-pointer hover:bg-gray-700"
                            :class="{'bg-blue-600': selectedMapId === id}"
                            @click="selectMap(id)">
                            {{ map.name }} ({{ id }})
                        </li>
                    </ul>
                    <button @click="addMap" class="w-full bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm mb-4">+ Add Map</button>

                    <div v-if="selectedMapId">
                        <h2 class="font-bold mb-2 text-gray-400">Map Settings</h2>
                        <div class="mb-2">
                            <label class="text-xs text-gray-500">ID</label>
                            <input v-model="selectedMapId" disabled class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-500">
                        </div>
                        <div class="mb-2">
                            <label class="text-xs text-gray-500">Name</label>
                            <input v-model="worldData.maps[selectedMapId].name" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                        </div>
                        <div class="mb-2">
                            <label class="text-xs text-gray-500">Type</label>
                            <select v-model="worldData.maps[selectedMapId].type" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                                <option value="field">Field</option>
                                <option value="castle">Castle</option>
                                <option value="dungeon">Dungeon</option>
                            </select>
                        </div>
                        <div class="mb-2">
                            <label class="text-xs text-gray-500">Level Req.</label>
                            <input v-model.number="worldData.maps[selectedMapId].level_requirement" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                        </div>
                        <div class="mb-2 grid grid-cols-2 gap-2">
                            <div>
                                <label class="text-xs text-gray-500">Respawn X</label>
                                <input v-model.number="worldData.maps[selectedMapId].respawn_x" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                            </div>
                            <div>
                                <label class="text-xs text-gray-500">Respawn Y</label>
                                <input v-model.number="worldData.maps[selectedMapId].respawn_y" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                            </div>
                        </div>
                        <button @click="deleteMap" class="w-full bg-red-900/50 hover:bg-red-900 text-red-200 p-2 rounded text-sm mb-4 border border-red-800">Delete Map</button>
                        
                        <h2 class="font-bold mt-4 mb-2 text-gray-400">Portals</h2>
                        <div v-for="(portal, idx) in worldData.maps[selectedMapId].portals" :key="idx" class="bg-gray-900 p-2 rounded mb-2 text-xs">
                            <div class="flex justify-between mb-1">
                                <span class="font-bold">{{ portal.label }}</span>
                                <button @click="removePortal(idx)" class="text-red-500">x</button>
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                                <input v-model.number="portal.x" placeholder="X" class="bg-gray-800 rounded px-1">
                                <input v-model.number="portal.y" placeholder="Y" class="bg-gray-800 rounded px-1">
                                <input v-model="portal.target_map_id" placeholder="Target Map" class="col-span-2 bg-gray-800 rounded px-1">
                                <input v-model.number="portal.target_x" placeholder="TX" class="bg-gray-800 rounded px-1">
                                <input v-model.number="portal.target_y" placeholder="TY" class="bg-gray-800 rounded px-1">
                                <div class="col-span-2 flex gap-1">
                                    <input v-model="portal.label" placeholder="Label" class="flex-1 bg-gray-800 rounded px-1">
                                    <input v-model="portal.color" type="color" class="w-8 h-6 bg-gray-800 rounded cursor-pointer">
                                </div>
                            </div>
                        </div>
                        <button @click="addPortal" class="w-full bg-gray-700 hover:bg-gray-600 p-1 rounded text-xs">+ Add Portal</button>

                        <h2 class="font-bold mt-4 mb-2 text-gray-400">Spawns</h2>
                        <div v-for="(spawn, idx) in worldData.maps[selectedMapId].spawns" :key="idx" class="bg-gray-900 p-2 rounded mb-2 text-xs">
                            <div class="flex justify-between mb-1">
                                <span class="font-bold">{{ spawn.template_id }} (x{{ spawn.count }})</span>
                                <button @click="removeSpawn(idx)" class="text-red-500">x</button>
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                                <input v-model="spawn.template_id" placeholder="Template" class="col-span-2 bg-gray-800 rounded px-1">
                                <input v-model.number="spawn.count" placeholder="Count" class="bg-gray-800 rounded px-1">
                                <input v-model.number="spawn.area.radius" placeholder="Radius" class="bg-gray-800 rounded px-1">
                                <input v-model.number="spawn.area.x" placeholder="X" class="bg-gray-800 rounded px-1">
                                <input v-model.number="spawn.area.y" placeholder="Y" class="bg-gray-800 rounded px-1">
                            </div>
                        </div>
                        <button @click="addSpawn" class="w-full bg-gray-700 hover:bg-gray-600 p-1 rounded text-xs">+ Add Spawn</button>
                    </div>
                </div>

                <!-- Canvas Preview -->
                <div class="flex-1 bg-black relative overflow-hidden flex items-center justify-center">
                    <div v-if="selectedMapId" class="relative bg-gray-900 border border-gray-700" style="width: 600px; height: 600px;">
                        <!-- Grid -->
                        <div class="absolute inset-0 opacity-20 pointer-events-none" 
                             style="background-image: linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px); background-size: 60px 60px;"></div>
                        
                        <!-- Portals -->
                        <div v-for="(portal, idx) in worldData.maps[selectedMapId].portals" :key="'p'+idx"
                             class="absolute w-4 h-4 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 cursor-move"
                             :style="{ left: (portal.x * 6) + 'px', top: (portal.y * 6) + 'px', backgroundColor: portal.color || '#fff' }"
                             title="Portal">
                        </div>

                        <!-- Spawns -->
                        <div v-for="(spawn, idx) in worldData.maps[selectedMapId].spawns" :key="'s'+idx"
                             class="absolute rounded-full border border-red-500 bg-red-500/20 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                             :style="{ 
                                left: (spawn.area.x * 6) + 'px', 
                                top: (spawn.area.y * 6) + 'px', 
                                width: (spawn.area.radius * 2 * 6) + 'px', 
                                height: (spawn.area.radius * 2 * 6) + 'px' 
                             }">
                             <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] text-red-300 whitespace-nowrap">
                                {{ spawn.template_id }} ({{ spawn.count }})
                             </div>
                        </div>
                    </div>
                    <div v-else class="text-gray-500">Select a map to edit</div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const worldData = ref({ maps: {}, monster_templates: {} });
        const selectedMapId = ref(null);

        const fetchWorld = async () => {
            const res = await fetch('http://localhost:8000/editor/world');
            if (res.ok) {
                worldData.value = await res.json();
                if (Object.keys(worldData.value.maps).length > 0) {
                    selectedMapId.value = Object.keys(worldData.value.maps)[0];
                }
            }
        };

        const saveWorld = async () => {
            const res = await fetch('http://localhost:8000/editor/world', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(worldData.value)
            });
            if (res.ok) alert('World Saved!');
            else alert('Failed to save');
        };

        const selectMap = (id) => selectedMapId.value = id;

        const deleteMap = () => {
            if (!selectedMapId.value) return;
            if (confirm(`Are you sure you want to delete ${selectedMapId.value}?`)) {
                delete worldData.value.maps[selectedMapId.value];
                selectedMapId.value = Object.keys(worldData.value.maps)[0] || null;
            }
        };

        const addMap = () => {
            const id = prompt("Enter Map ID (e.g., map_desert_1):");
            if (id && !worldData.value.maps[id]) {
                worldData.value.maps[id] = {
                    name: "New Map",
                    type: "field",
                    level_requirement: 0,
                    width: 100,
                    height: 100,
                    respawn_x: 50,
                    respawn_y: 50,
                    portals: [],
                    spawns: []
                };
                selectedMapId.value = id;
            }
        };

        const addPortal = () => {
            if (!selectedMapId.value) return;
            worldData.value.maps[selectedMapId.value].portals.push({
                id: 'p_' + Date.now(),
                x: 50, y: 50,
                target_map_id: '',
                target_x: 50, target_y: 50,
                label: 'Portal',
                color: '#ffffff'
            });
        };

        const removePortal = (idx) => {
            worldData.value.maps[selectedMapId.value].portals.splice(idx, 1);
        };

        const addSpawn = () => {
            if (!selectedMapId.value) return;
            worldData.value.maps[selectedMapId.value].spawns.push({
                template_id: 'rat',
                count: 1,
                area: { x: 50, y: 50, radius: 10 }
            });
        };

        const removeSpawn = (idx) => {
            worldData.value.maps[selectedMapId.value].spawns.splice(idx, 1);
        };

        onMounted(fetchWorld);

        return {
            worldData,
            selectedMapId,
            selectMap,
            deleteMap,
            saveWorld,
            addMap,
            addPortal,
            removePortal,
            addSpawn,
            removeSpawn
        };
    }
};
