import { player, logs, socket, currentMonster, addLog, showToast, mapMonsters, mapPlayers, isFreeFarming, selectedTargetId, pendingAttackId, destinationMarker, inspectedPlayer, autoSellInferior } from '../state.js';
import { checkAndAct, stopAutoFarm } from './autoFarm.js';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

export const api = {
    async fetchPlayer(id) {
        try {
            const res = await fetch(`${API_URL}/player/${id}`);
            if (res.ok) {
                player.value = await res.json();
                connectWebSocket(id);
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async createPlayer(name) {
        try {
            const res = await fetch(`${API_URL}/player?name=${encodeURIComponent(name)}&p_class=warrior`, { method: 'POST' });
            if (!res.ok) {
                if (res.status === 409) {
                    alert("Name already taken!");
                    return false;
                }
                throw new Error("Failed to create player");
            }
            const data = await res.json();
            player.value = data;
            localStorage.setItem('rpg_player_id', data.id);
            localStorage.setItem('rpg_player_token', data.token);
            connectWebSocket(data.id);
            addLog(`Welcome, ${data.name}!`, 'text-yellow-400');
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async fetchMapPlayers(mapId) {
        try {
            const res = await fetch(`${API_URL}/map/${mapId}/players`);
            if (res.ok) {
                mapPlayers.value = await res.json();
            }
        } catch (e) {
            console.error("Error fetching players:", e);
        }
    },

    async fetchMapMonsters(mapId) {
        try {
            const res = await fetch(`${API_URL}/map/${mapId}/monsters`);
            mapMonsters.value = await res.json();
        } catch (e) {
            console.error("Error fetching monsters:", e);
        }
    },

    async movePlayer(mapId, x, y) {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/move?target_map_id=${mapId}&x=${x}&y=${y}`, { method: 'POST' });
    },

    async attackMonster(monsterId) {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/attack?monster_id=${monsterId}`, { method: 'POST' });
    },

    async useItem(itemId) {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/use_item?item_id=${itemId}`, { method: 'POST' });
        await this.refreshPlayer();
    },

    async equipItem(itemId) {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/equip_item?item_id=${itemId}`, { method: 'POST' });
        await this.refreshPlayer();
    },

    async unequipItem(slot) {
        // Not implemented in UI yet, but good to have
    },

    async openChest() {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/open_chest`, { method: 'POST' });
        addLog('Opened Starter Chest!', 'text-purple-400');
        await this.refreshPlayer();
    },

    async refreshPlayer() {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}`);
        if (res.ok) {
            player.value = await res.json();
        }
    },

    async sellItem(itemId) {
        if (!player.value) return;
        // if (!confirm('Sell this item?')) return; // Removed confirm for auto-sell, or handled by caller? 
        // Wait, manual sell needs confirm. Auto-sell doesn't.
        // I should probably separate them or pass a flag.
        // For now, let's assume manual sell calls this and we want confirm.
        // But auto-sell calls this too.
        // I'll remove confirm here and put it in UI component for manual sell.
        const res = await fetch(`${API_URL}/player/${player.value.id}/sell_item?item_id=${itemId}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            addLog(`Sold item for ${data.gold_gained} Gold.`, 'text-yellow-300');
            await this.refreshPlayer();
        }
    },

    async allocateAttributes(diff) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/allocate_attributes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(diff)
        });
        if (res.ok) {
            addLog('Attributes updated!', 'text-purple-400');
            await this.refreshPlayer();
            return true;
        }
        return false;
    },

    async triggerAutoSell() {
        if (!player.value) return;
        const rarityValue = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
        let soldCount = 0;

        const inventory = [...player.value.inventory];

        for (const item of inventory) {
            if (item.type === 'weapon' || item.type === 'armor') {
                if (item.rarity !== 'rare' && item.rarity !== 'epic' && item.rarity !== 'legendary') {
                    const equipped = player.value.equipment[item.slot];
                    if (equipped) {
                        const itemRarityVal = rarityValue[item.rarity] || 0;
                        const equippedRarityVal = rarityValue[equipped.rarity] || 0;

                        let shouldSell = false;
                        if (itemRarityVal < equippedRarityVal) shouldSell = true;
                        else if (itemRarityVal === equippedRarityVal && item.power_score <= equipped.power_score) shouldSell = true;

                        if (shouldSell) {
                            // We use fetch directly or call sellItem? sellItem refreshes player every time.
                            // That's slow for bulk. But safer.
                            // Let's use sellItem but maybe suppress refresh?
                            // api.sellItem does refresh.
                            // Let's just call it. It will be sequential.
                            await this.sellItem(item.id);
                            soldCount++;
                        }
                    }
                }
            }
        }

        if (soldCount > 0) {
            showToast('💰', 'Auto-Clean', `Sold ${soldCount} items`, 'text-yellow-500');
        }
    }
};

export const connectWebSocket = (playerId) => {
    if (socket.value) return;

    socket.value = new WebSocket(`${WS_URL}/${playerId}`);

    socket.value.onopen = () => {
        addLog('Connected to server.', 'text-green-500');
    };

    socket.value.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'combat_update') {
            handleCombatUpdate(data);
        } else if (data.type === 'monster_respawn') {
            if (shouldAttack(data.monster)) {
                addLog(`A ${data.monster.name} has appeared!`, 'text-orange-300');
            }
            if (isFreeFarming.value || player.value.active_mission_id) {
                checkAndAct();
            }
        } else if (data.type === 'player_moved') {
            if (data.player_id === player.value.id) {
                if (!player.value.position) player.value.position = { x: 0, y: 0 };
                player.value.position.x = data.x;
                player.value.position.y = data.y;
                player.value.current_map_id = data.map_id;

                if (pendingAttackId.value) {
                    const target = mapMonsters.value.find(m => m.id === pendingAttackId.value);
                    if (target) {
                        const mx_game = target.position_x;
                        const my_game = target.position_y;
                        const dx = player.value.position.x - mx_game;
                        const dy = player.value.position.y - my_game;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < 5) {
                            api.attackMonster(pendingAttackId.value);
                            pendingAttackId.value = null;
                        }
                    }
                }
            } else {
                // Update other player
                const other = mapPlayers.value.find(p => p.id === data.player_id);
                if (other) {
                    if (!other.position) other.position = { x: 0, y: 0 };
                    other.position.x = data.x;
                    other.position.y = data.y;

                    // If they moved to a different map, remove them
                    if (data.map_id !== player.value.current_map_id) {
                        mapPlayers.value = mapPlayers.value.filter(p => p.id !== data.player_id);
                    }
                } else {
                    // If new player entered our map, fetch list
                    if (data.map_id === player.value.current_map_id) {
                        api.fetchMapPlayers(player.value.current_map_id);
                    }
                }
            }
        } else if (data.type === 'player_left') {
            mapPlayers.value = mapPlayers.value.filter(p => p.id !== data.player_id);
            if (inspectedPlayer.value && inspectedPlayer.value.id === data.player_id) {
                inspectedPlayer.value = null;
            }
        }
    };

    socket.value.onclose = () => {
        addLog('Disconnected from server.', 'text-red-500');
        socket.value = null;
        stopAutoFarm();
    };
};

const handleCombatUpdate = (data) => {
    // Only process updates for the local player
    if (data.player_id !== player.value.id) return;

    if (player.value && data.player_hp !== undefined) {
        player.value.stats.hp = data.player_hp;
    }

    if (data.monster_hp > 0) {
        if (!currentMonster.value) {
            currentMonster.value = {
                name: data.monster_name || "Enemy",
                hp: data.monster_hp,
                max_hp: data.monster_max_hp || 50,
                level: 1
            };
        } else {
            if (data.monster_name) currentMonster.value.name = data.monster_name;
            if (data.monster_max_hp) currentMonster.value.max_hp = data.monster_max_hp;
        }
        currentMonster.value.hp = data.monster_hp;
    } else {
        currentMonster.value = null;
    }

    const log = data.log;
    if (log.next_level_xp) player.value.next_level_xp = log.next_level_xp;
    if (log.player_dmg) addLog(`You hit monster for ${log.player_dmg} dmg.`, 'text-blue-300');
    if (log.monster_dmg) addLog(`Monster hit you for ${log.monster_dmg} dmg.`, 'text-red-300');
    if (log.monster_died) {
        addLog(`Monster died! Gained ${log.xp_gained} XP.`, 'text-yellow-400');

        // Remove from local state immediately using the ID from server
        if (data.monster_id) {
            mapMonsters.value = mapMonsters.value.filter(m => m.id !== data.monster_id);

            // If this was our pending target, clear it
            if (pendingAttackId.value === data.monster_id) {
                pendingAttackId.value = null;
            }
        }

        currentMonster.value = null;
        api.refreshPlayer();
        setTimeout(checkAndAct, 200);
    }
    if (log.player_died) {
        addLog(`You died! Respawning at Castle...`, 'text-red-600 font-bold');
        api.refreshPlayer();
        stopAutoFarm();
        pendingAttackId.value = null;
    }

    if (data.drops && data.drops.length > 0) {
        const rarityValue = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

        data.drops.forEach(async drop => {
            let sold = false;

            // Only consider auto-selling if enabled and item is equipment
            if (autoSellInferior.value && (drop.type === 'weapon' || drop.type === 'armor')) {
                // NEVER auto-sell Rare, Epic, or Legendary drops
                if (drop.rarity !== 'rare' && drop.rarity !== 'epic' && drop.rarity !== 'legendary') {

                    const equipped = player.value.equipment[drop.slot];
                    if (equipped) {
                        const dropRarityVal = rarityValue[drop.rarity] || 0;
                        const equippedRarityVal = rarityValue[equipped.rarity] || 0;

                        // Rule: Sell Common/Uncommon if equipped is strictly better rarity
                        // Common (1) < Uncommon (2) -> Sell
                        // Uncommon (2) < Rare (3) -> Sell
                        if (dropRarityVal < equippedRarityVal) {
                            api.sellItem(drop.id);
                            showToast('💰', 'Auto-sold (Low Rarity)', `${drop.name}`, 'text-yellow-500');
                            sold = true;
                        }
                        // Rule: If same rarity (Common/Uncommon only), sell if inferior Power Score
                        else if (dropRarityVal === equippedRarityVal && drop.power_score <= equipped.power_score) {
                            api.sellItem(drop.id);
                            showToast('💰', 'Auto-sold (Inferior)', `${drop.name}`, 'text-yellow-500');
                            sold = true;
                        }
                    }
                }
            }

            if (!sold) {
                showToast(drop.icon || '📦', drop.name, `x${drop.quantity || 1}`, getRarityColor(drop.rarity));
            }
        });
    }

    if (log.level_up) {
        showToast('🆙', 'Level Up!', `You reached level ${log.new_level}!`, 'text-yellow-400');
        addLog(`Level Up! You are now level ${log.new_level}.`, 'text-yellow-400 font-bold');
    }
};

const shouldAttack = (monster) => {
    if (!selectedTargetId.value) return true;
    return monster.template_id === selectedTargetId.value;
};

export const getRarityColor = (rarity) => {
    const colors = {
        common: 'text-gray-400',
        uncommon: 'text-green-400',
        rare: 'text-purple-400',
        epic: 'text-red-500',
        legendary: 'text-yellow-400'
    };
    return colors[rarity] || 'text-gray-300';
};
