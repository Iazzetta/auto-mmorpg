import { ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { api } from '../services/api.js';

export default {
    template: `
        <div class="fixed inset-0 bg-black/90 z-50 flex text-white font-mono">
            <!-- Sidebar -->
            <div class="w-64 border-r border-gray-800 p-4 flex flex-col gap-2 overflow-y-auto">
                <h1 class="text-xl font-bold mb-4 text-purple-400">World Editor</h1>
                
                <div class="flex gap-2 mb-4">
                    <button @click="activeTab = 'maps'" :class="{'bg-purple-600': activeTab === 'maps', 'bg-gray-800': activeTab !== 'maps'}" class="flex-1 p-1 rounded text-xs">Maps</button>
                    <button @click="activeTab = 'monsters'" :class="{'bg-purple-600': activeTab === 'monsters', 'bg-gray-800': activeTab !== 'monsters'}" class="flex-1 p-1 rounded text-xs">Monsters</button>
                </div>

                <div v-if="activeTab === 'maps'">
                    <button @click="addMap" class="w-full bg-green-700 hover:bg-green-600 p-2 rounded mb-4">+ New Map</button>
                    <div v-for="(map, id) in worldData.maps" :key="id" 
                        @click="selectMap(id)"
                        class="cursor-pointer p-2 rounded hover:bg-gray-800"
                        :class="{'bg-gray-800 border-l-4 border-purple-500': selectedMapId === id}">
                        {{ map.name }} <span class="text-xs text-gray-500">({{ id }})</span>
                    </div>
                </div>

                <div v-if="activeTab === 'monsters'">
                    <button @click="addMonster" class="w-full bg-green-700 hover:bg-green-600 p-2 rounded mb-4">+ New Monster</button>
                    <div v-for="(monster, id) in worldData.monster_templates" :key="id" 
                        @click="selectMonster(id)"
                        class="cursor-pointer p-2 rounded hover:bg-gray-800"
                        :class="{'bg-gray-800 border-l-4 border-purple-500': selectedMonsterId === id}">
                        {{ monster.name }} <span class="text-xs text-gray-500">({{ id }})</span>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 p-4 overflow-y-auto relative">
                <button @click="$emit('close')" class="absolute top-4 right-4 text-gray-500 hover:text-white">Close (ESC)</button>
                <button @click="saveWorld" class="absolute top-4 right-32 bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Save World</button>

                <!-- Map Editor -->
                <div v-if="activeTab === 'maps' && selectedMapId && worldData.maps[selectedMapId]" class="max-w-2xl mx-auto">
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
                            <span class="font-bold text-green-400">{{ spawn.template_id }}</span>
                            <button @click="removeSpawn(idx)" class="text-red-500">x</button>
                        </div>
                        <div class="grid grid-cols-2 gap-1">
                            <div class="col-span-2">
                                <label class="text-[10px] text-gray-500">Monster</label>
                                <select v-model="spawn.template_id" class="w-full bg-gray-800 rounded px-1">
                                    <option v-for="(m, mid) in worldData.monster_templates" :key="mid" :value="mid">{{ m.name }} ({{ mid }})</option>
                                </select>
                            </div>
                            <input v-model.number="spawn.count" placeholder="Count" class="bg-gray-800 rounded px-1">
                            <input v-model.number="spawn.area.radius" placeholder="Radius" class="bg-gray-800 rounded px-1">
                            <input v-model.number="spawn.area.x" placeholder="X" class="bg-gray-800 rounded px-1">
                            <input v-model.number="spawn.area.y" placeholder="Y" class="bg-gray-800 rounded px-1">
                        </div>
                    </div>
                    <button @click="addSpawn" class="w-full bg-gray-700 hover:bg-gray-600 p-1 rounded text-xs">+ Add Spawn</button>
                </div>

                <!-- Monster Editor -->
                <div v-if="activeTab === 'monsters' && selectedMonsterId && worldData.monster_templates[selectedMonsterId]" class="max-w-2xl mx-auto">
                    <h2 class="font-bold mb-2 text-gray-400">Monster Settings</h2>
                    <div class="mb-2">
                        <label class="text-xs text-gray-500">ID</label>
                        <input v-model="selectedMonsterId" disabled class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-500">
                    </div>
                    <div class="mb-2">
                        <label class="text-xs text-gray-500">Name</label>
                        <input v-model="worldData.monster_templates[selectedMonsterId].name" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                    </div>
                    <div class="mb-2 grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs text-gray-500">Type</label>
                            <select v-model="worldData.monster_templates[selectedMonsterId].m_type" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                                <option value="aggressive">Aggressive</option>
                                <option value="passive">Passive</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-gray-500">Level</label>
                            <input v-model.number="worldData.monster_templates[selectedMonsterId].level" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                        </div>
                    </div>
                    <div class="mb-2 grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs text-gray-500">XP Reward</label>
                            <input v-model.number="worldData.monster_templates[selectedMonsterId].xp_reward" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                        </div>
                        <div>
                            <label class="text-xs text-gray-500">Respawn Time (s)</label>
                            <input v-model.number="worldData.monster_templates[selectedMonsterId].respawn_time" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1">
                        </div>
                    </div>

                    <h3 class="font-bold mt-4 mb-2 text-gray-400">Stats</h3>
                    <div class="grid grid-cols-3 gap-2 mb-4">
                        <div><label class="text-xs text-gray-500">HP</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.max_hp" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"></div>
                        <div><label class="text-xs text-gray-500">ATK</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.atk" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"></div>
                        <div><label class="text-xs text-gray-500">DEF</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.def_" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"></div>
                        <div><label class="text-xs text-gray-500">Speed</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.speed" type="number" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"></div>
                        <div><label class="text-xs text-gray-500">Cooldown</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.attack_cooldown" type="number" step="0.1" class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1"></div>
                    </div>

                    <h3 class="font-bold mt-4 mb-2 text-gray-400">Drops</h3>
                    <div v-for="(drop, idx) in worldData.monster_templates[selectedMonsterId].drops" :key="idx" class="bg-gray-900 p-2 rounded mb-2 text-xs flex gap-2 items-center">
                        <select v-model="drop.item_id" class="flex-1 bg-gray-800 rounded px-1">
                            <option v-for="item in availableItems" :key="item.id" :value="item.id">{{ item.name }}</option>
                        </select>
                        <input v-model.number="drop.chance" type="number" step="0.01" placeholder="Chance (0-1)" class="w-20 bg-gray-800 rounded px-1">
                        <button @click="removeDrop(idx)" class="text-red-500">x</button>
                    </div>
                    <button @click="addDrop" class="w-full bg-gray-700 hover:bg-gray-600 p-1 rounded text-xs">+ Add Drop</button>

                    <button @click="deleteMonster" class="w-full mt-8 bg-red-900/50 hover:bg-red-900 text-red-200 p-2 rounded text-sm mb-4 border border-red-800">Delete Monster</button>
                </div>
                </div>

                <!-- Canvas Preview -->
                <div class="flex-1 bg-black relative overflow-hidden flex items-center justify-center border-l border-gray-800"
                     @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
                    
                    <!-- Map Container (Responsive) -->
                    <div v-if="selectedMapId && worldData.maps[selectedMapId]" 
                         class="relative bg-gray-900 border border-gray-700 shadow-2xl" 
                         style="width: 90%; aspect-ratio: 1/1; max-height: 90%;">
                        
                        <!-- Grid -->
                        <div class="absolute inset-0 opacity-20 pointer-events-none" 
                             style="background-image: linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px); background-size: 10% 10%;"></div>
                        
                        <!-- Portals -->
                        <div v-for="(portal, idx) in worldData.maps[selectedMapId].portals" :key="'p'+idx"
                             class="absolute w-4 h-4 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 cursor-move z-10 hover:scale-125 transition-transform"
                             :style="{ left: portal.x + '%', top: portal.y + '%', backgroundColor: portal.color || '#fff' }"
                             @mousedown.prevent="startDrag('portal', idx)"
                             :title="portal.label || 'Portal'">
                        </div>

                        <!-- Spawns -->
                        <div v-for="(spawn, idx) in worldData.maps[selectedMapId].spawns" :key="'s'+idx"
                             class="absolute rounded-full border border-red-500 bg-red-500/20 transform -translate-x-1/2 -translate-y-1/2 cursor-move hover:bg-red-500/30 transition-colors"
                             :style="{ 
                                left: spawn.area.x + '%', 
                                top: spawn.area.y + '%', 
                                width: (spawn.area.radius * 2) + '%', 
                                height: (spawn.area.radius * 2) + '%' 
                             }"
                             @mousedown.prevent="startDrag('spawn', idx)">
                             <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] text-red-300 whitespace-nowrap font-bold drop-shadow-md pointer-events-none">
                                {{ spawn.template_id }} ({{ spawn.count }})
                             </div>
                        </div>

                        <!-- Respawn Point (Draggable) -->
                        <div class="absolute w-4 h-4 bg-blue-500 border-2 border-white transform -translate-x-1/2 -translate-y-1/2 cursor-move z-20 hover:scale-125 transition-transform"
                             :style="{ left: worldData.maps[selectedMapId].respawn_x + '%', top: worldData.maps[selectedMapId].respawn_y + '%' }"
                             @mousedown.prevent="startDrag('respawn', 0)"
                             title="Player Spawn">
                             <div class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-300 font-bold whitespace-nowrap pointer-events-none">Player Spawn</div>
                        </div>
                    </div>
                    <div v-else class="text-gray-500">Select a map to edit</div>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const worldData = ref({ maps: {}, monster_templates: {} });
        const selectedMapId = ref(null);
        const selectedMonsterId = ref(null);
        const activeTab = ref('maps');
        const availableItems = ref([]);

        const fetchWorld = async () => {
            try {
                const res = await fetch('http://localhost:8000/editor/world');
                if (res.ok) {
                    worldData.value = await res.json();
                    if (Object.keys(worldData.value.maps).length > 0) {
                        selectedMapId.value = Object.keys(worldData.value.maps)[0];
                    }
                }
                const itemsRes = await fetch('http://localhost:8000/editor/items');
                if (itemsRes.ok) {
                    availableItems.value = await itemsRes.json();
                }
            } catch (e) {
                console.error(e);
            }
        };

        const saveWorld = async () => {
            try {
                // Ensure HP matches Max HP for templates just in case
                for (const m of Object.values(worldData.value.monster_templates)) {
                    m.stats.hp = m.stats.max_hp;
                }
                const res = await fetch('http://localhost:8000/editor/world', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(worldData.value)
                });
                if (res.ok) alert('World saved!');
                else alert('Error saving world');
            } catch (e) {
                console.error(e);
                alert('Error saving world');
            }
        };

        const selectMap = (id) => selectedMapId.value = id;
        const selectMonster = (id) => selectedMonsterId.value = id;

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
                id: `p_${Date.now()}`,
                x: 50, y: 50,
                target_map_id: "",
                target_x: 50, target_y: 50,
                label: "Portal",
                color: "#ffffff"
            });
        };

        const removePortal = (idx) => {
            worldData.value.maps[selectedMapId.value].portals.splice(idx, 1);
        };

        const addSpawn = () => {
            if (!selectedMapId.value) return;
            const firstMonster = Object.keys(worldData.value.monster_templates)[0] || "rat";
            worldData.value.maps[selectedMapId.value].spawns.push({
                template_id: firstMonster,
                count: 1,
                area: { x: 50, y: 50, radius: 10 }
            });
        };

        const removeSpawn = (idx) => {
            worldData.value.maps[selectedMapId.value].spawns.splice(idx, 1);
        };

        // Monster Logic
        const addMonster = () => {
            const id = prompt("Enter Monster ID (e.g., dragon):");
            if (id && !worldData.value.monster_templates[id]) {
                worldData.value.monster_templates[id] = {
                    name: "New Monster",
                    m_type: "aggressive",
                    level: 1,
                    xp_reward: 10,
                    respawn_time: 10,
                    stats: {
                        hp: 100, max_hp: 100, atk: 10, def_: 5, speed: 1.0, attack_cooldown: 2.0
                    },
                    drops: []
                };
                selectedMonsterId.value = id;
            }
        };

        const deleteMonster = () => {
            if (!selectedMonsterId.value) return;
            if (confirm(`Delete ${selectedMonsterId.value}?`)) {
                delete worldData.value.monster_templates[selectedMonsterId.value];
                selectedMonsterId.value = Object.keys(worldData.value.monster_templates)[0] || null;
            }
        };

        const addDrop = () => {
            if (!selectedMonsterId.value) return;
            worldData.value.monster_templates[selectedMonsterId.value].drops.push({
                item_id: availableItems.value[0]?.id || "",
                chance: 0.5
            });
        };

        const removeDrop = (idx) => {
            worldData.value.monster_templates[selectedMonsterId.value].drops.splice(idx, 1);
        };

        const dragging = ref(null);

        const startDrag = (type, index) => {
            dragging.value = { type, index };
        };

        const handleMouseMove = (e) => {
            if (!dragging.value || !selectedMapId.value) return;

            const container = e.currentTarget.querySelector('.relative'); // The map container
            const rect = container.getBoundingClientRect();

            // Calculate percentage (0-100)
            const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

            const map = worldData.value.maps[selectedMapId.value];

            if (dragging.value.type === 'portal') {
                map.portals[dragging.value.index].x = Math.round(x);
                map.portals[dragging.value.index].y = Math.round(y);
            } else if (dragging.value.type === 'spawn') {
                map.spawns[dragging.value.index].area.x = Math.round(x);
                map.spawns[dragging.value.index].area.y = Math.round(y);
            } else if (dragging.value.type === 'respawn') {
                map.respawn_x = Math.round(x);
                map.respawn_y = Math.round(y);
            }
        };

        const handleMouseUp = () => {
            dragging.value = null;
        };

        onMounted(fetchWorld);

        return {
            worldData,
            selectedMapId,
            selectedMonsterId,
            activeTab,
            availableItems,
            selectMap,
            selectMonster,
            deleteMap,
            saveWorld,
            addMap,
            addPortal,
            removePortal,
            addSpawn,
            removeSpawn,
            addMonster,
            deleteMonster,
            addDrop,
            removeDrop,
            startDrag,
            handleMouseMove,
            handleMouseUp
        };
    }
};
