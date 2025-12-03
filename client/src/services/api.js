import { player, logs, socket, currentMonster, addLog, showToast, mapMonsters, isFreeFarming, selectedTargetId, pendingAttackId, destinationMarker } from '../state.js';
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

    async createPlayer() {
        try {
            const res = await fetch(`${API_URL}/player?name=Hero&p_class=warrior`, { method: 'POST' });
            const data = await res.json();
            player.value = data;
            localStorage.setItem('rpg_player_id', data.id);
            connectWebSocket(data.id);
            addLog(`Welcome, ${data.name}!`, 'text-yellow-400');
            return true;
        } catch (e) {
            console.error(e);
            return false;
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
        if (!confirm('Sell this item?')) return;
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
        }
    };

    socket.value.onclose = () => {
        addLog('Disconnected from server.', 'text-red-500');
        socket.value = null;
        stopAutoFarm();
    };
};

const handleCombatUpdate = (data) => {
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
        api.refreshPlayer();
        setTimeout(checkAndAct, 200);
    }
    if (log.player_died) {
        addLog(`You died! Respawning at Castle...`, 'text-red-600 font-bold');
        api.refreshPlayer();
        stopAutoFarm();
    }

    if (data.drops && data.drops.length > 0) {
        data.drops.forEach(drop => {
            showToast(drop.icon || '📦', drop.name, `x${drop.quantity || 1}`, getRarityColor(drop.rarity));
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
