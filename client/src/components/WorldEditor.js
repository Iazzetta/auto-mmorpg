import { ref, onMounted, computed, reactive } from 'vue';
import { missions } from '../state.js';
import { api } from '../services/api.js';

export default {
    emits: ['close'],
    template: `
        <div class="fixed inset-0 bg-black/90 z-50 flex flex-col text-white font-mono overflow-hidden">
            <!-- Top Navigation Bar -->
            <div class="h-14 bg-gray-900 border-b border-gray-700 flex items-center px-4 justify-between shrink-0 z-10 shadow-lg">
                <h1 class="text-xl font-bold text-yellow-500 flex items-center gap-2 mr-8">
                    <span>🌍</span> World Editor
                </h1>
                
                <div class="flex gap-1 bg-gray-800 p-1 rounded">
                    <button @click="activeTab = 'maps'" :class="{'bg-blue-600 text-white': activeTab === 'maps', 'text-gray-400 hover:text-white hover:bg-gray-700': activeTab !== 'maps'}" class="px-4 py-1.5 rounded text-sm font-bold transition-colors">Maps</button>
                    <button @click="activeTab = 'monsters'" :class="{'bg-purple-600 text-white': activeTab === 'monsters', 'text-gray-400 hover:text-white hover:bg-gray-700': activeTab !== 'monsters'}" class="px-4 py-1.5 rounded text-sm font-bold transition-colors">Monsters</button>
                    <button @click="activeTab = 'items'" :class="{'bg-yellow-600 text-white': activeTab === 'items', 'text-gray-400 hover:text-white hover:bg-gray-700': activeTab !== 'items'}" class="px-4 py-1.5 rounded text-sm font-bold transition-colors">Items</button>
                    <button @click="activeTab = 'npcs'" :class="{'bg-orange-600 text-white': activeTab === 'npcs', 'text-gray-400 hover:text-white hover:bg-gray-700': activeTab !== 'npcs'}" class="px-4 py-1.5 rounded text-sm font-bold transition-colors">NPCs</button>
                    <button @click="activeTab = 'missions'" :class="{'bg-green-600 text-white': activeTab === 'missions', 'text-gray-400 hover:text-white hover:bg-gray-700': activeTab !== 'missions'}" class="px-4 py-1.5 rounded text-sm font-bold transition-colors">Missions</button>
                    <button @click="activeTab = 'rewards'" :class="{'bg-pink-600 text-white': activeTab === 'rewards', 'text-gray-400 hover:text-white hover:bg-gray-700': activeTab !== 'rewards'}" class="px-4 py-1.5 rounded text-sm font-bold transition-colors">Rewards</button>
                </div>

                <div class="ml-auto flex gap-2">
                    <button @click="saveAll" class="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold shadow-lg text-sm transition-colors flex items-center gap-2">
                        <span>💾</span> SAVE ALL
                    </button>
                    <button @click="$emit('close')" class="bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white px-4 py-2 rounded text-sm transition-colors">✕</button>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 flex overflow-hidden">
                
                <!-- Sidebar (List & Details) -->
                <div class="w-96 border-r border-gray-800 bg-gray-900/95 flex flex-col overflow-hidden shrink-0">
                    
                    <!-- MAPS SIDEBAR -->
                    <div v-if="activeTab === 'maps'" class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
                        <button @click="addMap" class="w-full bg-blue-700 hover:bg-blue-600 p-2 rounded text-sm font-bold">+ New Map</button>
                        
                        <div class="flex flex-col gap-1 max-h-60 min-h-[200px] shrink-0 overflow-y-auto border border-gray-700 rounded p-1 bg-black/50">
                            <div v-for="(map, id) in worldData.maps" :key="id" 
                                @click="selectMap(id)"
                                class="cursor-pointer p-2 rounded hover:bg-gray-800 text-xs flex justify-between items-center"
                                :class="{'bg-gray-800 border-l-2 border-blue-500': selectedMapId === id}">
                                <span>{{ map.name }}</span>
                                <span class="text-gray-500 text-[10px]">{{ id }}</span>
                            </div>
                        </div>

                        <div v-if="selectedMapId && worldData.maps[selectedMapId]" class="flex flex-col gap-2 border-t border-gray-700 pt-4">
                            <h3 class="font-bold text-gray-400 text-xs uppercase">Map Settings</h3>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">ID</label>
                                <input v-model="selectedMapId" disabled class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-gray-500 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Name</label>
                                <input v-model="worldData.maps[selectedMapId].name" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Type</label>
                                    <select v-model="worldData.maps[selectedMapId].type" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="field">Field</option>
                                        <option value="dungeon">Dungeon</option>
                                        <option value="safe">Safe Zone</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Level Req.</label>
                                    <input v-model.number="worldData.maps[selectedMapId].level_requirement" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                                <div class="col-span-2">
                                    <label class="text-[10px] text-gray-500 uppercase">Floor Texture</label>
                                    <select v-model="worldData.maps[selectedMapId].texture" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="">None (Grid)</option>
                                        <option v-for="t in floorTextures" :key="t" :value="t">{{ t }}</option>
                                    </select>
                                </div>
                            </div>

                            <h3 class="font-bold text-gray-400 text-xs uppercase mt-2">Portals</h3>
                            <div class="space-y-2">
                                <div v-for="(portal, idx) in worldData.maps[selectedMapId].portals" :key="idx" class="bg-black p-2 rounded border border-gray-700 text-xs">
                                    <div class="flex justify-between mb-1">
                                        <span class="font-bold text-blue-400">Portal {{ idx + 1 }}</span>
                                        <button @click="removePortal(idx)" class="text-red-500 hover:text-red-400">x</button>
                                    </div>
                                    <div class="grid grid-cols-2 gap-1">
                                        <input v-model="portal.label" placeholder="Label" class="col-span-2 bg-gray-800 rounded px-1 py-0.5">
                                        <input v-model="portal.target_map_id" placeholder="Target Map ID" class="col-span-2 bg-gray-800 rounded px-1 py-0.5">
                                        <input v-model.number="portal.target_x" placeholder="TX" class="bg-gray-800 rounded px-1 py-0.5">
                                        <input v-model.number="portal.target_y" placeholder="TY" class="bg-gray-800 rounded px-1 py-0.5">
                                    </div>
                                </div>
                                <button @click="addPortal" class="w-full bg-gray-800 hover:bg-gray-700 py-1 rounded text-xs border border-gray-600">+ Add Portal</button>
                            </div>

                            <h3 class="font-bold text-gray-400 text-xs uppercase mt-2">Spawns</h3>
                            <div class="space-y-2">
                                <div v-for="(spawn, idx) in worldData.maps[selectedMapId].spawns" :key="idx" class="bg-black p-2 rounded border border-gray-700 text-xs">
                                    <div class="flex justify-between mb-1">
                                        <span class="font-bold text-red-400">{{ spawn.template_id }}</span>
                                        <button @click="removeSpawn(idx)" class="text-red-500 hover:text-red-400">x</button>
                                    </div>
                                    <div class="grid grid-cols-2 gap-1">
                                        <select v-model="spawn.template_id" class="col-span-2 bg-gray-800 rounded px-1 py-0.5">
                                            <option v-for="(m, mid) in worldData.monster_templates" :key="mid" :value="mid">{{ m.name }}</option>
                                        </select>
                                        <div>
                                            <label class="text-[9px] text-gray-500">Count</label>
                                            <input v-model.number="spawn.count" type="number" class="w-full bg-gray-800 rounded px-1 py-0.5">
                                        </div>
                                        <div>
                                            <label class="text-[9px] text-gray-500">Radius</label>
                                            <input v-model.number="spawn.area.radius" type="number" class="w-full bg-gray-800 rounded px-1 py-0.5">
                                        </div>
                                    </div>
                                </div>
                                <button @click="addSpawn" class="w-full bg-gray-800 hover:bg-gray-700 py-1 rounded text-xs border border-gray-600">+ Add Spawn</button>
                            </div>
                            
                            <button @click="deleteMap" class="mt-4 bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-xs border border-red-800">Delete Map</button>
                        </div>
                    </div>

                    <!-- MONSTERS SIDEBAR -->
                    <div v-if="activeTab === 'monsters'" class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
                        <button @click="addMonster" class="w-full bg-purple-700 hover:bg-purple-600 p-2 rounded text-sm font-bold">+ New Monster</button>
                        
                        <div class="flex flex-col gap-1 max-h-60 min-h-[200px] shrink-0 overflow-y-auto border border-gray-700 rounded p-1 bg-black/50">
                            <div v-for="(monster, id) in worldData.monster_templates" :key="id" 
                                @click="selectMonster(id)"
                                class="cursor-pointer p-2 rounded hover:bg-gray-800 text-xs flex justify-between items-center"
                                :class="{'bg-gray-800 border-l-2 border-purple-500': selectedMonsterId === id}">
                                <span>{{ monster.name }}</span>
                                <span class="text-gray-500 text-[10px]">{{ id }}</span>
                            </div>
                        </div>

                        <div v-if="selectedMonsterId && worldData.monster_templates[selectedMonsterId]" class="flex flex-col gap-2 border-t border-gray-700 pt-4">
                            <h3 class="font-bold text-gray-400 text-xs uppercase">Monster Stats</h3>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">ID</label>
                                <input v-model="selectedMonsterId" disabled class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-gray-500 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Name</label>
                                <input v-model="worldData.monster_templates[selectedMonsterId].name" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Type</label>
                                    <select v-model="worldData.monster_templates[selectedMonsterId].m_type" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="aggressive">Aggressive</option>
                                        <option value="passive">Passive</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Level</label>
                                    <input v-model.number="worldData.monster_templates[selectedMonsterId].level" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-3 gap-1">
                                 <div><label class="text-[9px] text-gray-500">HP</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.max_hp" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">ATK</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.atk" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">DEF</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.def_" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">SPD</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.speed" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">CD</label><input v-model.number="worldData.monster_templates[selectedMonsterId].stats.attack_cooldown" type="number" step="0.1" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">XP</label><input v-model.number="worldData.monster_templates[selectedMonsterId].xp_reward" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                            </div>

                            <h3 class="font-bold text-gray-400 text-xs uppercase mt-2">Drops</h3>
                            <div class="space-y-1">
                                <div v-for="(drop, idx) in worldData.monster_templates[selectedMonsterId].drops" :key="idx" class="flex gap-1 items-center bg-black p-1 rounded border border-gray-700">
                                    <select v-model="drop.item_id" class="flex-1 bg-gray-800 rounded px-1 py-0.5 text-xs w-20">
                                        <option v-for="(item, iid) in availableItems" :key="iid" :value="iid">{{ item.name }}</option>
                                    </select>
                                    <input v-model.number="drop.chance" type="number" step="0.1" class="w-12 bg-gray-800 rounded px-1 py-0.5 text-xs">
                                    <button @click="removeDrop(idx)" class="text-red-500 text-xs px-1">x</button>
                                </div>
                                <button @click="addDrop" class="w-full bg-gray-800 hover:bg-gray-700 py-1 rounded text-xs border border-gray-600">+ Add Drop</button>
                            </div>

                            <button @click="deleteMonster" class="mt-4 bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-xs border border-red-800">Delete Monster</button>
                        </div>
                    </div>

                    <!-- ITEMS SIDEBAR -->
                    <div v-if="activeTab === 'items'" class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
                        <button @click="addItem" class="w-full bg-yellow-700 hover:bg-yellow-600 p-2 rounded text-sm font-bold text-white">+ New Item</button>
                        
                        <div class="flex flex-col gap-1 max-h-60 min-h-[200px] shrink-0 overflow-y-auto border border-gray-700 rounded p-1 bg-black/50">
                            <div v-for="(item, id) in availableItems" :key="id" 
                                @click="selectItem(id)"
                                class="cursor-pointer p-2 rounded hover:bg-gray-800 text-xs flex justify-between items-center"
                                :class="{'bg-gray-800 border-l-2 border-yellow-500': selectedItemId === id}">
                                <span class="truncate">{{ item.name }}</span>
                                <span class="text-gray-500 text-[10px]">{{ item.icon }}</span>
                            </div>
                        </div>

                        <div v-if="selectedItemId && availableItems[selectedItemId]" class="flex flex-col gap-2 border-t border-gray-700 pt-4">
                            <h3 class="font-bold text-gray-400 text-xs uppercase">Item Details</h3>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">ID</label>
                                <input v-model="selectedItemId" disabled class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-gray-500 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Name</label>
                                <input v-model="availableItems[selectedItemId].name" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Type</label>
                                    <select v-model="availableItems[selectedItemId].type" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="weapon">Weapon</option>
                                        <option value="armor">Armor</option>
                                        <option value="consumable">Consumable</option>
                                        <option value="material">Material</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Slot</label>
                                    <select v-model="availableItems[selectedItemId].slot" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="hand_main">Main Hand</option>
                                        <option value="hand_off">Off Hand</option>
                                        <option value="head">Head</option>
                                        <option value="chest">Chest</option>
                                        <option value="legs">Legs</option>
                                        <option value="boots">Boots</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </div>
                             <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Rarity</label>
                                    <select v-model="availableItems[selectedItemId].rarity" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="common">Common</option>
                                        <option value="uncommon">Uncommon</option>
                                        <option value="rare">Rare</option>
                                        <option value="epic">Epic</option>
                                        <option value="legendary">Legendary</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Icon</label>
                                    <input v-model="availableItems[selectedItemId].icon" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs text-center">
                                </div>
                            </div>
                            
                            <h3 class="font-bold text-gray-400 text-xs uppercase mt-2">Stats</h3>
                            <div class="grid grid-cols-3 gap-1">
                                 <div><label class="text-[9px] text-gray-500">ATK</label><input v-model.number="availableItems[selectedItemId].stats.atk" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">DEF</label><input v-model.number="availableItems[selectedItemId].stats.def_" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">HP</label><input v-model.number="availableItems[selectedItemId].stats.hp" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">SPD</label><input v-model.number="availableItems[selectedItemId].stats.speed" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">STR</label><input v-model.number="availableItems[selectedItemId].stats.strength" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">PWR</label><input v-model.number="availableItems[selectedItemId].power_score" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                            </div>

                            <h3 class="font-bold text-gray-400 text-xs uppercase mt-2">Consumable Effects</h3>
                            <div class="grid grid-cols-3 gap-1">
                                 <div><label class="text-[9px] text-gray-500">XP</label><input v-model.number="availableItems[selectedItemId].stats.xp" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">Gold</label><input v-model.number="availableItems[selectedItemId].stats.gold" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                                 <div><label class="text-[9px] text-gray-500">Diamonds</label><input v-model.number="availableItems[selectedItemId].stats.diamonds" type="number" class="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-xs"></div>
                             </div>

                            <button @click="deleteItem" class="mt-4 bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-xs border border-red-800">Delete Item</button>
                        </div>
                    </div>

                    <!-- NPCS SIDEBAR -->
                    <div v-if="activeTab === 'npcs'" class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
                        <div class="flex gap-2">
                            <button @click="addNpc" class="flex-1 bg-orange-700 hover:bg-orange-600 p-2 rounded text-sm font-bold">+ New NPC</button>
                            <button @click="fetchWorld" class="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold" title="Refresh">🔄</button>
                        </div>
                        
                        <div class="text-xs text-gray-500 mb-1">Total NPCs: {{ Object.keys(npcs).length }}</div>

                        <div class="flex flex-col gap-1 max-h-60 min-h-[200px] shrink-0 overflow-y-auto border border-gray-700 rounded p-1 bg-black/50">
                            <div v-for="(npc, id) in npcs" :key="id" 
                                @click="selectNpc(id)"
                                class="cursor-pointer p-2 rounded hover:bg-gray-800 text-xs flex justify-between items-center"
                                :class="{'bg-gray-800 border-l-2 border-orange-500': selectedNpcId === id}">
                                <span>{{ npc.name }}</span>
                                <span class="text-gray-500 text-[10px]">{{ npc.map_id }}</span>
                            </div>
                        </div>

                        <div v-if="selectedNpcId && npcs[selectedNpcId]" class="flex flex-col gap-2 border-t border-gray-700 pt-4">
                            <h3 class="font-bold text-gray-400 text-xs uppercase">NPC Details</h3>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">ID</label>
                                <input v-model="selectedNpcId" disabled class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-gray-500 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Name</label>
                                <input v-model="npcs[selectedNpcId].name" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Type</label>
                                    <select v-model="npcs[selectedNpcId].type" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="quest_giver">Quest Giver</option>
                                        <option value="merchant">Merchant</option>
                                        <option value="dialogue">Dialogue Only</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Icon</label>
                                    <input v-model="npcs[selectedNpcId].icon" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs text-center">
                                </div>
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Map</label>
                                <select v-model="npcs[selectedNpcId].map_id" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                    <option v-for="(m, mid) in worldData.maps" :key="mid" :value="mid">{{ m.name }}</option>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">X</label>
                                    <input v-model.number="npcs[selectedNpcId].x" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Y</label>
                                    <input v-model.number="npcs[selectedNpcId].y" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                            </div>

                            <!-- Quest Giver Specific -->
                            <div v-if="npcs[selectedNpcId].type === 'quest_giver'">
                                <label class="text-[10px] text-gray-500 uppercase">Quest ID</label>
                                <select v-model="npcs[selectedNpcId].quest_id" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                    <option value="">None</option>
                                    <option v-for="(m, mid) in missions" :key="mid" :value="mid">{{ m.title }}</option>
                                </select>
                            </div>

                            <!-- Merchant Specific -->
                            <div v-if="npcs[selectedNpcId].type === 'merchant'">
                                <label class="text-[10px] text-gray-500 uppercase">Shop Items</label>
                                <div class="flex flex-col gap-1">
                                    <div v-for="(item, idx) in npcs[selectedNpcId].shop_items" :key="idx" class="flex gap-1">
                                        <select v-model="npcs[selectedNpcId].shop_items[idx]" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                             <option v-for="(i, iid) in availableItems" :key="iid" :value="iid">{{ i.name }}</option>
                                        </select>
                                        <button @click="npcs[selectedNpcId].shop_items.splice(idx, 1)" class="text-red-500">x</button>
                                    </div>
                                    <button @click="npcs[selectedNpcId].shop_items.push(Object.keys(availableItems)[0])" class="text-xs text-blue-400">+ Add Item</button>
                                </div>
                            </div>

                            <!-- Dialogue Editor -->
                            <div class="mt-2 text-white/50 border-t border-gray-700/50 pt-2">
                                <label class="text-[10px] text-gray-500 uppercase">Opening Dialogue</label>
                                <div class="flex flex-col gap-1">
                                    <div v-for="(line, idx) in (npcs[selectedNpcId].dialog_start || [])" :key="idx" class="flex gap-1">
                                         <input v-model="npcs[selectedNpcId].dialog_start[idx]" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs" placeholder="Dialogue Line...">
                                         <button @click="npcs[selectedNpcId].dialog_start.splice(idx, 1)" class="text-red-500">x</button>
                                    </div>
                                    <button @click="if(!npcs[selectedNpcId].dialog_start) npcs[selectedNpcId].dialog_start = []; npcs[selectedNpcId].dialog_start.push('')" class="text-xs text-blue-400 self-start">+ Add Line</button>
                                </div>
                            </div>

                            <button @click="deleteNpc" class="mt-4 bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-xs border border-red-800">Delete NPC</button>
                        </div>
                    </div>

                    <!-- MISSIONS SIDEBAR -->
                    <div v-if="activeTab === 'missions'" class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
                        <button @click="createNewMission" class="w-full bg-green-700 hover:bg-green-600 p-2 rounded text-sm font-bold">+ New Mission</button>
                        
                        <div class="flex flex-col gap-1 max-h-60 min-h-[200px] shrink-0 overflow-y-auto border border-gray-700 rounded p-1 bg-black/50">
                            <div v-for="(mission, id) in missions" :key="id" 
                                 @click="selectMission(id, mission)"
                                 :class="{'bg-gray-800 border-l-2 border-green-500': selectedMissionId === id}"
                                 class="cursor-pointer p-2 rounded hover:bg-gray-800 text-xs flex justify-between items-center">
                                <span>{{ mission.title }}</span>
                                <span class="text-gray-500 text-[10px]">Lv. {{ mission.level_requirement }}</span>
                            </div>
                        </div>

                        <div v-if="selectedMission" class="flex flex-col gap-2 border-t border-gray-700 pt-4">
                            <h3 class="font-bold text-gray-400 text-xs uppercase">Mission Details</h3>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">ID</label>
                                <input v-model="selectedMissionId" disabled class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-gray-500 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Title</label>
                                <input v-model="selectedMission.title" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] text-gray-500 uppercase">Description</label>
                                <textarea v-model="selectedMission.description" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs h-16"></textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                 <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Level Req.</label>
                                    <input v-model.number="selectedMission.level_requirement" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Map</label>
                                    <select v-model="selectedMission.map_id" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option v-for="(m, mid) in worldData.maps" :key="mid" :value="mid">{{ m.name }}</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- MISSION TYPE SELECTOR -->
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Type</label>
                                    <select v-model="selectedMission.type" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="kill">Kill Monsters</option>
                                        <option value="collect">Collect Items</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Source</label>
                                    <select v-model="selectedMission.source" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option value="board">Mission Board</option>
                                        <option value="npc">NPC</option>
                                    </select>
                                </div>
                            </div>

                            <!-- DYNAMIC TARGET FIELDS -->
                            <div v-if="selectedMission.type === 'kill'" class="grid grid-cols-2 gap-2">
                                 <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Target Monster</label>
                                    <select v-model="selectedMission.target_monster_id" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option v-for="(m, mid) in worldData.monster_templates" :key="mid" :value="mid">{{ m.name }}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Count</label>
                                    <input v-model.number="selectedMission.target_count" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                            </div>
                            <div v-else-if="selectedMission.type === 'collect'" class="grid grid-cols-2 gap-2">
                                 <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Target Item</label>
                                    <select v-model="selectedMission.target_item_id" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                        <option v-for="(i, iid) in availableItems" :key="iid" :value="iid">{{ i.name }}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Count</label>
                                    <input v-model.number="selectedMission.target_count" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                            </div>

                             <div class="grid grid-cols-2 gap-2">
                                 <div>
                                    <label class="text-[10px] text-gray-500 uppercase">XP</label>
                                    <input v-model.number="selectedMission.reward_xp" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 uppercase">Gold</label>
                                    <input v-model.number="selectedMission.reward_gold" type="number" class="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- REWARDS SIDEBAR -->
                    <div v-if="activeTab === 'rewards'" class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
                        <h3 class="font-bold text-pink-400 uppercase text-sm border-b border-gray-700 pb-2">Starter Chest</h3>
                        <div class="space-y-2">
                            <div v-for="(item, idx) in rewardsData.starter_chest" :key="idx" class="bg-black p-2 rounded border border-gray-700 text-xs flex items-center gap-2">
                                <select v-model="item.item_id" class="flex-1 bg-gray-800 rounded px-1 py-1">
                                    <option v-for="(i, iid) in availableItems" :key="iid" :value="iid">{{ i.name }}</option>
                                </select>
                                <input v-model.number="item.quantity" type="number" class="w-12 bg-gray-800 rounded px-1 py-1 text-center" placeholder="Qty">
                                <button @click="removeRewardItem(idx)" class="text-red-500 hover:text-red-400 px-1 font-bold">✕</button>
                            </div>
                            <button @click="addRewardItem" class="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded text-xs border border-gray-600">+ Add Item</button>
                        </div>
                    </div>

                </div>

                <!-- MAIN CONTENT AREA (VISUAL EDITOR) -->
                <div class="flex-1 bg-black relative overflow-hidden flex items-center justify-center">
                    
                    <!-- MAP VISUAL EDITOR -->
                    <div v-if="activeTab === 'maps' || activeTab === 'npcs'" 
                         class="relative w-full h-full flex items-center justify-center bg-gray-900"
                         @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
                        
                        <div v-if="selectedMapId && worldData.maps[selectedMapId]" 
                             class="relative bg-black border border-gray-700 shadow-2xl" 
                             style="width: 80vh; height: 80vh;">
                            
                            <!-- Grid Background -->
                            <div class="absolute inset-0 opacity-20 pointer-events-none" 
                                 style="background-image: linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px); background-size: 10% 10%;"></div>
                            
                            <!-- Portals -->
                            <div v-for="(portal, idx) in worldData.maps[selectedMapId].portals" :key="'p'+idx"
                                 class="absolute w-6 h-6 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 cursor-move z-20 hover:scale-110 transition-transform shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                 :style="{ left: portal.x + '%', top: portal.y + '%', backgroundColor: portal.color || '#fff' }"
                                 @mousedown.prevent="startDrag('portal', idx)"
                                 :title="portal.label || 'Portal'">
                                 <div class="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] text-white whitespace-nowrap bg-black/50 px-1 rounded pointer-events-none">{{ portal.label }}</div>
                            </div>

                            <!-- Spawns -->
                            <div v-for="(spawn, idx) in worldData.maps[selectedMapId].spawns" :key="'s'+idx"
                                 class="absolute rounded-full border border-red-500 bg-red-500/10 transform -translate-x-1/2 -translate-y-1/2 cursor-move hover:bg-red-500/20 transition-colors z-10"
                                 :style="{ 
                                    left: (spawn.area?.x || 50) + '%', 
                                    top: (spawn.area?.y || 50) + '%', 
                                    width: ((spawn.area?.radius || 5) * 2) + '%', 
                                    height: ((spawn.area?.radius || 5) * 2) + '%' 
                                 }"
                                 @mousedown.prevent="startDrag('spawn', idx)">
                                 <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] text-red-300 whitespace-nowrap font-bold drop-shadow-md pointer-events-none text-center">
                                    {{ spawn.template_id }}<br>x{{ spawn.count }}
                                 </div>
                            </div>

                            <!-- Respawn Point -->
                            <div class="absolute w-4 h-4 bg-blue-500 border-2 border-white transform -translate-x-1/2 -translate-y-1/2 cursor-move z-30 hover:scale-125 transition-transform shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                                 :style="{ left: worldData.maps[selectedMapId].respawn_x + '%', top: worldData.maps[selectedMapId].respawn_y + '%' }"
                                 @mousedown.prevent="startDrag('respawn', 0)"
                                 title="Player Spawn">
                                 <div class="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] text-blue-300 font-bold whitespace-nowrap pointer-events-none">SPAWN</div>
                            </div>

                            <!-- Coordinates Overlay -->
                            <div class="absolute bottom-2 right-2 text-xs text-gray-500 font-mono pointer-events-none">
                                {{ Math.round(cursorX) }}, {{ Math.round(cursorY) }}
                            </div>

                            <!-- NPCs -->
                            <div v-for="(npc, id) in npcs" :key="'n'+id"
                                 v-show="npc.map_id === selectedMapId"
                                 class="absolute w-6 h-6 rounded-full border-2 border-orange-500 bg-orange-500/50 transform -translate-x-1/2 -translate-y-1/2 cursor-move z-20 hover:scale-110 transition-transform shadow-[0_0_10px_rgba(255,165,0,0.5)] flex items-center justify-center text-xs"
                                 :style="{ left: npc.x + '%', top: npc.y + '%' }"
                                 @mousedown.prevent="startDrag('npc', id)"
                                 :title="npc.name">
                                 {{ npc.icon }}
                            </div>
                        </div>
                        <div v-else class="text-gray-500 flex flex-col items-center">
                            <span class="text-4xl mb-2">🗺️</span>
                            <span>Select a map to edit visually</span>
                        </div>
                    </div>

                    <!-- MONSTER PREVIEW (Placeholder) -->
                    <div v-if="activeTab === 'monsters'" class="flex items-center justify-center text-gray-500">
                        <div class="text-center">
                            <span class="text-6xl block mb-4">👾</span>
                            <p>Monster Visual Preview</p>
                            <p class="text-sm opacity-50">(Coming Soon)</p>
                        </div>
                    </div>

                    <!-- ITEMS PREVIEW -->
                    <div v-if="activeTab === 'items'" class="flex items-center justify-center text-gray-500">
                         <div v-if="selectedItemId && availableItems[selectedItemId]" class="text-center p-8 border border-gray-700 rounded bg-gray-900">
                            <div class="text-8xl mb-4">{{ availableItems[selectedItemId].icon }}</div>
                            <h2 class="text-2xl font-bold text-white">{{ availableItems[selectedItemId].name }}</h2>
                            <p class="text-sm" :class="{'text-gray-400': availableItems[selectedItemId].rarity === 'common', 'text-green-400': availableItems[selectedItemId].rarity === 'uncommon', 'text-blue-400': availableItems[selectedItemId].rarity === 'rare', 'text-purple-400': availableItems[selectedItemId].rarity === 'epic', 'text-yellow-400': availableItems[selectedItemId].rarity === 'legendary'}">
                                {{ availableItems[selectedItemId].rarity.toUpperCase() }} {{ availableItems[selectedItemId].type.toUpperCase() }}
                            </p>
                        </div>
                        <div v-else class="text-center">
                            <span class="text-6xl block mb-4">⚔️</span>
                            <p>Select an item to edit</p>
                        </div>


                    </div>

                    <!-- MISSION PREVIEW (Placeholder) -->
                    <div v-if="activeTab === 'missions'" class="flex items-center justify-center text-gray-500">
                        <div class="text-center">
                            <span class="text-6xl block mb-4">📜</span>
                            <p>Mission Flow Editor</p>
                            <p class="text-sm opacity-50">(Coming Soon)</p>
                        </div>
                    </div>

                    <!-- REWARDS PREVIEW -->
                    <div v-if="activeTab === 'rewards'" class="flex items-center justify-center text-gray-500">
                        <div class="text-center">
                            <span class="text-6xl block mb-4">🎁</span>
                            <p>Configure Starter Rewards</p>
                            <p class="text-sm opacity-50">Items players receive when opening the Starter Chest</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `,
    setup() {
        const worldData = ref({ maps: {}, monster_templates: {} });
        const selectedMapId = ref(null);
        const selectedMonsterId = ref(null);
        const selectedMissionId = ref(null);
        const selectedMission = ref(null);
        const activeTab = ref('maps');
        const availableItems = ref({});
        const selectedItemId = ref(null);
        const cursorX = ref(0);
        const cursorY = ref(0);
        const rewardsData = ref({ starter_chest: [] });
        const npcs = ref({});
        const selectedNpcId = ref(null);
        const floorTextures = ref([]);

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
                const rewardsRes = await fetch('http://localhost:8000/editor/rewards');
                if (rewardsRes.ok) {
                    rewardsData.value = await rewardsRes.json();
                }
                // Fetch NPCs
                const npcsRes = await fetch('http://localhost:8000/editor/npcs');
                if (npcsRes.ok) {
                    npcs.value = await npcsRes.json();
                }
                // Fetch Textures
                const texRes = await fetch('http://localhost:8000/editor/textures/floors');
                if (texRes.ok) {
                    floorTextures.value = await texRes.json();
                }
            } catch (e) { console.error(e); }
        };

        const saveAll = async () => {
            try {
                // Save World (Maps & Monsters)
                for (const m of Object.values(worldData.value.monster_templates)) {
                    m.stats.hp = m.stats.max_hp;
                }
                const worldRes = await fetch('http://localhost:8000/editor/world', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(worldData.value)
                });

                // Save Missions
                const missionsRes = await fetch('http://localhost:8000/admin/missions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(missions.value)
                });

                // Save Items
                const itemsRes = await fetch('http://localhost:8000/editor/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(availableItems.value)
                });

                // Save Rewards
                const rewardsRes = await fetch('http://localhost:8000/editor/rewards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rewardsData.value)
                });

                // Save NPCs
                const npcsRes = await fetch('http://localhost:8000/editor/npcs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(npcs.value)
                });

                if (worldRes.ok && missionsRes.ok && itemsRes.ok && rewardsRes.ok && npcsRes.ok) alert('All changes saved successfully!');
                else alert('Error saving some data.');
            } catch (e) {
                console.error(e);
                alert('Error saving.');
            }
        };

        // --- MAP LOGIC ---
        const selectMap = (id) => selectedMapId.value = id;
        const addMap = () => {
            const id = prompt("Enter Map ID (e.g., map_desert_1):");
            if (id && !worldData.value.maps[id]) {
                worldData.value.maps[id] = {
                    name: "New Map", type: "field", level_requirement: 0,
                    width: 100, height: 100, respawn_x: 50, respawn_y: 50,
                    portals: [], spawns: []
                };
                selectedMapId.value = id;
            }
        };
        const deleteMap = () => {
            if (!selectedMapId.value) return;
            if (confirm(`Delete ${selectedMapId.value}?`)) {
                delete worldData.value.maps[selectedMapId.value];
                selectedMapId.value = Object.keys(worldData.value.maps)[0] || null;
            }
        };
        const addPortal = () => {
            if (!selectedMapId.value) return;
            worldData.value.maps[selectedMapId.value].portals.push({
                id: `p_${Date.now()}`, x: 50, y: 50, target_map_id: "", target_x: 50, target_y: 50, label: "Portal", color: "#ffffff"
            });
        };
        const removePortal = (idx) => worldData.value.maps[selectedMapId.value].portals.splice(idx, 1);
        const addSpawn = () => {
            if (!selectedMapId.value) return;
            const firstMonster = Object.keys(worldData.value.monster_templates)[0] || "rat";
            worldData.value.maps[selectedMapId.value].spawns.push({
                template_id: firstMonster, count: 1, area: { x: 50, y: 50, radius: 10 }
            });
        };
        const removeSpawn = (idx) => worldData.value.maps[selectedMapId.value].spawns.splice(idx, 1);

        // --- MONSTER LOGIC ---
        const selectMonster = (id) => selectedMonsterId.value = id;
        const addMonster = () => {
            const id = prompt("Enter Monster ID (e.g., dragon):");
            if (id && !worldData.value.monster_templates[id]) {
                worldData.value.monster_templates[id] = {
                    name: "New Monster", m_type: "aggressive", level: 1, xp_reward: 10, respawn_time: 10,
                    stats: { hp: 100, max_hp: 100, atk: 10, def_: 5, speed: 1.0, attack_cooldown: 2.0 }, drops: []
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
            const firstItem = Object.keys(availableItems.value)[0] || "";
            worldData.value.monster_templates[selectedMonsterId.value].drops.push({ item_id: firstItem, chance: 0.5 });
        };
        const removeDrop = (idx) => worldData.value.monster_templates[selectedMonsterId.value].drops.splice(idx, 1);

        // --- ITEM LOGIC ---
        const selectItem = (id) => selectedItemId.value = id;
        const addItem = () => {
            const id = prompt("Enter Item ID (e.g., item_sword_new):");
            if (id && !availableItems.value[id]) {
                availableItems.value[id] = {
                    name: "New Item", type: "weapon", slot: "hand_main", rarity: "common",
                    stats: { atk: 0, def_: 0, hp: 0, speed: 0, strength: 0, xp: 0, gold: 0, diamonds: 0 }, power_score: 0, icon: "📦"
                };
                selectedItemId.value = id;
            }
        };
        const deleteItem = () => {
            if (!selectedItemId.value) return;
            if (confirm(`Delete ${selectedItemId.value}?`)) {
                delete availableItems.value[selectedItemId.value];
                selectedItemId.value = null;
            }
        };

        // --- MISSION LOGIC ---
        const selectMission = (id, mission) => {
            selectedMissionId.value = id;
            selectedMission.value = mission;
        };
        const createNewMission = () => {
            const id = `mission_${Date.now()}`;
            const newMission = {
                id: id, title: "New Mission", description: "Description", level_requirement: 1,
                map_id: "map_forest_1", target_template_id: "wolf", target_count: 5, reward_xp: 100, reward_gold: 50,
                type: "kill", source: "board" // Default values
            };
            missions.value[id] = newMission;
            selectMission(id, newMission);
        };

        // --- REWARDS LOGIC ---
        const addRewardItem = () => {
            const firstItem = Object.keys(availableItems.value)[0] || "";
            rewardsData.value.starter_chest.push({ item_id: firstItem, quantity: 1 });
        };
        const removeRewardItem = (idx) => {
            rewardsData.value.starter_chest.splice(idx, 1);
        };

        // --- NPC LOGIC ---
        const selectNpc = (id) => selectedNpcId.value = id;
        const addNpc = () => {
            const id = prompt("Enter NPC ID (e.g., npc_guide_02):");
            if (id && !npcs.value[id]) {
                npcs.value[id] = {
                    id: id, name: "New NPC", map_id: "map_castle_1", x: 50, y: 50,
                    type: "quest_giver", icon: "👤", dialogue: ["Hello"], quest_id: "", shop_items: []
                };
                selectedNpcId.value = id;
            }
        };
        const deleteNpc = () => {
            if (!selectedNpcId.value) return;
            if (confirm(`Delete ${selectedNpcId.value}?`)) {
                delete npcs.value[selectedNpcId.value];
                selectedNpcId.value = null;
            }
        };

        // --- DRAG & DROP LOGIC ---
        const dragging = ref(null);
        const startDrag = (type, index) => dragging.value = { type, index };
        const handleMouseMove = (e) => {
            const container = e.currentTarget.querySelector('.relative');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
            cursorX.value = x;
            cursorY.value = y;

            if (!dragging.value || !selectedMapId.value) return;
            const map = worldData.value.maps[selectedMapId.value];

            if (dragging.value.type === 'portal') {
                map.portals[dragging.value.index].x = Math.round(x);
                map.portals[dragging.value.index].y = Math.round(y);
            } else if (dragging.value.type === 'spawn') {
                if (!map.spawns[dragging.value.index].area) map.spawns[dragging.value.index].area = { x: 50, y: 50, radius: 5 };
                map.spawns[dragging.value.index].area.x = Math.round(x);
                map.spawns[dragging.value.index].area.y = Math.round(y);
            } else if (dragging.value.type === 'respawn') {
                map.respawn_x = Math.round(x);
                map.respawn_y = Math.round(y);
            } else if (dragging.value.type === 'npc') {
                const npc = npcs.value[dragging.value.index];
                if (npc) {
                    npc.x = Math.round(x);
                    npc.y = Math.round(y);
                }
            }
        };
        const handleMouseUp = () => dragging.value = null;

        onMounted(fetchWorld);

        return {
            worldData, missions, availableItems, rewardsData, npcs,
            activeTab, selectedMapId, selectedMonsterId, selectedMissionId, selectedMission, selectedItemId, selectedNpcId,
            selectMap, addMap, deleteMap, addPortal, removePortal, addSpawn, removeSpawn,
            selectMonster, addMonster, deleteMonster, addDrop, removeDrop,
            selectMission, createNewMission,
            selectItem, addItem, deleteItem,
            addRewardItem, removeRewardItem,
            selectNpc, addNpc, deleteNpc,
            saveAll,
            startDrag, handleMouseMove, handleMouseUp, cursorX, cursorY, floorTextures
        };
    }
};
