import { player, logs, chatMessages, socket, currentMonster, addLog, addAlert, mapMonsters, mapPlayers, mapNpcs, isFreeFarming, selectedTargetId, pendingAttackId, destinationMarker, inspectedPlayer, autoSellInferior, currentMapData, isUpdating, worldData, isManuallyMoving } from '../state.js';
import { checkAndAct, stopAutoFarm } from './autoFarm.js';

export const API_URL = 'http://localhost:8000';
export const WS_URL = 'ws://localhost:8000/ws';

export const api = {
    async fetchPlayer(id) {
        try {
            const res = await fetch(`${API_URL}/player/${id}`);
            if (res.ok) {
                player.value = await res.json();
                this.fetchMapDetails(player.value.current_map_id);
                this.fetchMapNpcs(player.value.current_map_id);
                connectWebSocket(id);
                return true;
            }
            console.warn("Failed to fetch player, clearing session.");
            localStorage.removeItem('rpg_player_id');
            localStorage.removeItem('rpg_player_token');
            player.value = null;
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async login(name, password) {
        try {
            const res = await fetch(`${API_URL}/login?name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                this.handleAuthSuccess(data);
                return true;
            }
            if (res.status === 401) alert("Wrong password");
            else if (res.status === 404) alert("User not found");
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async register(name, password) {
        try {
            const res = await fetch(`${API_URL}/register?name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}&p_class=warrior`, { method: 'POST' });
            if (!res.ok) {
                if (res.status === 409) alert("Name taken");
                return false;
            }
            const data = await res.json();
            this.handleAuthSuccess(data);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    handleAuthSuccess(data) {
        player.value = data;
        localStorage.setItem('rpg_player_id', data.id);
        localStorage.setItem('rpg_player_token', data.token);
        this.fetchMapDetails(data.current_map_id);
        this.fetchMapNpcs(data.current_map_id);
        connectWebSocket(data.id);
        addLog(`Welcome, ${data.name}!`, 'text-yellow-400');
    },

    async fetchMapDetails(mapId) {
        try {
            const res = await fetch(`${API_URL}/map/${mapId}`);
            if (res.ok) {
                currentMapData.value = await res.json();
            }
        } catch (e) {
            console.error("Error fetching map details:", e);
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

    async fetchMapNpcs(mapId) {
        try {
            const res = await fetch(`${API_URL}/map/${mapId}/npcs`);
            if (res.ok) {
                mapNpcs.value = await res.json();
            }
        } catch (e) {
            console.error("Error fetching NPCs:", e);
        }
    },

    async movePlayer(mapId, x, y) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/move?target_map_id=${mapId}&x=${x}&y=${y}`, { method: 'POST' });
        if (!res.ok) {
            const data = await res.json();
            showGameAlert(data.detail || "Cannot move there!", "error");
        } else {
            const data = await res.json();
            if (data.map_id && data.map_id !== player.value.current_map_id) {
                player.value.current_map_id = data.map_id;
                player.value.position = data.position;
                player.value.state = 'idle';
                api.fetchMapDetails(data.map_id);
                api.fetchMapMonsters(data.map_id);
                api.fetchMapNpcs(data.map_id);
            }
        }
    },

    async stopMovement() {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/stop`, { method: 'POST' });
        player.value.state = 'idle';
    },

    async attackMonster(monsterId) {
        if (!player.value) return;
        player.value.state = 'combat';
        await fetch(`${API_URL}/player/${player.value.id}/attack?monster_id=${monsterId}`, { method: 'POST' });
    },

    async useItem(itemId) {
        if (!player.value) return;
        await fetch(`${API_URL}/player/${player.value.id}/use_item?item_id=${itemId}`, { method: 'POST' });
        await this.refreshPlayer();
    },

    async equipItem(itemId) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/equip?item_id=${itemId}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            player.value.equipment = data.equipment;
            if (data.inventory) player.value.inventory = data.inventory;
            if (data.stats) player.value.stats = data.stats;
        } else {
            await this.refreshPlayer();
        }
    },

    async unequipItem(slot) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/unequip?slot=${slot}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            player.value.equipment = data.equipment;
            if (data.inventory) player.value.inventory = data.inventory;
            if (data.stats) player.value.stats = data.stats;
        }
    },

    async openChest() {
        if (!player.value) return;
        await this.claimReward('starter_chest');
    },

    async getRewards() {
        const res = await fetch(`${API_URL}/rewards`);
        if (res.ok) {
            return await res.json();
        }
        return [];
    },

    async claimReward(rewardId) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/reward/claim?reward_id=${rewardId}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            // Claim Reward
            player.value.inventory = data.inventory;
            player.value.equipment = data.equipment || player.value.equipment; // New Field 
            player.value.gold = data.gold;
            player.value.diamonds = data.diamonds;
            player.value.claimed_rewards = data.claimed_rewards;
            if (data.stats) player.value.stats = data.stats;

            // Show Alerts for specific rewards
            if (data.rewards_summary && data.rewards_summary.length > 0) {
                for (const r of data.rewards_summary) {
                    if (r.type === 'gold') {
                        addAlert(`${r.amount} Gold`, 'gold', r.icon, 'Reward');
                    } else if (r.type === 'diamonds') {
                        addAlert(`${r.amount} Diamonds`, 'success', r.icon, 'Reward');
                    } else if (r.type === 'item') {
                        addAlert(r.name, 'drop', r.icon, `x${r.amount}`, r.rarity);
                    }
                }
            } else {
                addAlert('Reward Claimed!', 'success', '🎁');
            }
            return true;
        } else {
            const err = await res.json();
            addAlert(err.detail || "Failed to claim", 'error');
            return false;
        }
    },

    async refreshPlayer() {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}`);
        if (res.ok) {
            player.value = await res.json();
            if (player.value.state !== 'combat') {
                currentMonster.value = null;
            }
        }
    },

    async sellItem(itemId) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/sell_item?item_id=${itemId}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            addLog(`Sold item for ${data.gold_gained} Gold.`, 'text-yellow-300');
            addAlert(`${data.gold_gained} Gold`, 'gold', '💰', 'Item Sold');
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

    async upgradeItem(itemId) {
        if (!player.value) return { success: false, message: 'No player loaded' };

        try {
            const res = await fetch(`${API_URL}/player/${player.value.id}/upgrade?item_id=${itemId}`, { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                // Success
                await this.refreshPlayer();
                showToast('✨', 'Upgrade Successful!', data.message, 'text-yellow-400');
                return data; // Return full data so caller can use it
            } else {
                // Failure (Network ok, but logic failed)
                await this.refreshPlayer(); // Even on failure, catalysts might be consumed
                showGameAlert(data.message || 'Upgrade Failed', 'error');
                return data;
            }
        } catch (e) {
            console.error(e);
            return { success: false, message: 'Connection Error' };
        }
    },

    // Auto-sell trigger
    async triggerAutoSell() {
        if (!player.value) return;
        // Logic handled by server usually, but here we might need endpoint.
        // Assuming /sell_junk or similar exists?
        // Or we iterate client side (bad).
        // For now, placeholder.
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
    },

    async revivePlayer() {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/revive`, { method: 'POST' });
        if (res.ok) {
            await this.refreshPlayer();
            return true;
        } else {
            const data = await res.json();
            alert(data.detail || "Failed to revive");
            return false;
        }
    },

    async respawnPlayer() {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/respawn`, { method: 'POST' });
        if (res.ok) {
            await this.refreshPlayer();
            // Force map details refresh if map changed
            const data = await res.json();
            if (data.map_id) {
                this.fetchMapDetails(data.map_id);
            }
        }
    },

    async sendMessage(text) {
        if (!socket.value || socket.value.readyState !== 1) return;
        socket.value.send(JSON.stringify({ type: 'chat', message: text }));
    },

    async startMission(missionId) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/mission/start?mission_id=${missionId}`, { method: 'POST' });
        if (res.ok) {
            await this.refreshPlayer();
        }
    },

    async claimMission() {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/mission/claim`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            showToast('🎁', 'Mission Complete!', `XP: ${data.rewards.xp}, Gold: ${data.rewards.gold}`, 'text-yellow-400');
            await this.refreshPlayer();
        }
    },

    async startGathering(resourceId) {
        if (!player.value) return false;
        try {
            const res = await fetch(`${API_URL}/player/${player.value.id}/action/start_gather?resource_id=${resourceId}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                return data.duration_ms || 2000;
            } else {
                const err = await res.json();
                showToast('❌', 'Start Failed', err.detail, 'text-red-500');
                return false;
            }
        } catch (e) { console.error(e); return false; }
    },

    async gatherResource(resourceId) {
        if (!player.value) return;
        const res = await fetch(`${API_URL}/player/${player.value.id}/gather?resource_id=${resourceId}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();

            // Loop items to show distinct alerts (like premium games)
            // Backend now returns 'loot' with name/icon/rarity/quantity
            if (data.loot && data.loot.length > 0) {
                for (const item of data.loot) {
                    // addAlert(message, type, icon, subtext, rarity)
                    addAlert(item.name, 'drop', item.icon, `x${item.quantity || 1}`, item.rarity);
                }
            } else {
                addAlert('Resource gathered', 'success', '🪵', 'Empty?');
            }

            await this.refreshPlayer();
            // Trigger refresh of map details to update cooldowns
            this.fetchMapDetails(player.value.current_map_id);
            return true;
        } else {
            const err = await res.json();
            addAlert(err.detail || "Failed to gather", 'error');
            return false;
        }
    }
};

export const connectWebSocket = (playerId) => {
    if (socket.value) return;

    socket.value = new WebSocket(`${WS_URL}/${playerId}`);

    socket.value.onopen = () => {
        addLog('Connected to server.', 'text-green-500');
    };

    socket.value.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'combat_update') {
            handleCombatUpdate(data);
        } else if (data.type === 'chat') {
            chatMessages.value.push({
                id: Date.now(),
                name: data.name,
                message: data.message,
                isPlayer: data.player_id === player.value.id,
                time: new Date().toLocaleTimeString()
            });
            if (chatMessages.value.length > 100) chatMessages.value.shift();
        } else if (data.type === 'monster_respawn') {
            // Add to local list if on same map
            if (data.monster.map_id === player.value.current_map_id) {
                // Check if already exists to avoid duplicates
                if (!mapMonsters.value.find(m => m.id === data.monster.id)) {
                    mapMonsters.value.push(data.monster);
                }
            }

            if (shouldAttack(data.monster)) {
                addLog(`A ${data.monster.name} has appeared!`, 'text-orange-300');
            }
            if (isFreeFarming.value || player.value.active_mission_id) {
                checkAndAct();
            }
        } else if (data.type === 'batch_update') {
            for (const entity of data.entities) {
                if (entity.type === 'player') {
                    if (entity.id === player.value.id) {
                        if (!player.value.position) player.value.position = { x: 0, y: 0 };
                        player.value.position.x = entity.x;
                        player.value.position.y = entity.y;
                        if (entity.state) player.value.state = entity.state;
                        if (entity.target_id !== undefined) player.value.target_id = entity.target_id;

                        if (player.value.current_map_id !== entity.map_id) {
                            player.value.current_map_id = entity.map_id;
                            api.fetchMapDetails(entity.map_id);
                        }

                        if (pendingAttackId.value) {
                            const target = mapMonsters.value.find(m => m.id === pendingAttackId.value);
                            if (target) {
                                const mx_game = target.position_x;
                                const my_game = target.position_y;
                                const dx = player.value.position.x - mx_game;
                                const dy = player.value.position.y - my_game;
                                const dist = Math.sqrt(dx * dx + dy * dy);

                                if (dist < 1.0) {
                                    api.attackMonster(pendingAttackId.value);
                                    pendingAttackId.value = null;
                                }
                            }
                        }
                    } else {
                        const other = mapPlayers.value.find(p => p.id === entity.id);
                        if (other) {
                            if (!other.position) other.position = { x: 0, y: 0 };
                            other.position.x = entity.x;
                            other.position.y = entity.y;
                            if (entity.state) other.state = entity.state;
                            if (entity.target_id !== undefined) other.target_id = entity.target_id;

                            if (entity.map_id !== player.value.current_map_id) {
                                mapPlayers.value = mapPlayers.value.filter(p => p.id !== entity.id);
                            }
                        } else {
                            if (entity.map_id === player.value.current_map_id) {
                                api.fetchMapPlayers(player.value.current_map_id);
                            }
                        }
                    }
                } else if (entity.type === 'monster') {
                    const m = mapMonsters.value.find(m => m.id === entity.id);
                    if (m) {
                        m.position_x = entity.x;
                        m.position_y = entity.y;
                        if (entity.state) m.state = entity.state;
                    }
                }
            }
        } else if (data.type === 'server_update') {
            isUpdating.value = true;

            // Reload world data
            try {
                const worldRes = await fetch('http://localhost:8000/editor/world');
                if (worldRes.ok) worldData.value = await worldRes.json();

                // Refresh current map
                if (player.value) {
                    api.fetchMapDetails(player.value.current_map_id);
                    api.fetchMapMonsters(player.value.current_map_id);

                    try {
                        const npcsRes = await fetch(`http://localhost:8000/map/${player.value.current_map_id}/npcs`);
                        if (npcsRes.ok) mapNpcs.value = await npcsRes.json();
                    } catch (e) { console.error(e); }
                }
            } catch (e) { console.error(e); }

            // Hide modal after a short delay
            setTimeout(() => {
                isUpdating.value = false;
                showToast('✅', 'Server Updated', 'World data has been refreshed.', 'text-green-400');
            }, 2000);
        } else if (data.type === 'player_left') {
            mapPlayers.value = mapPlayers.value.filter(p => p.id !== data.player_id);
            if (inspectedPlayer.value && inspectedPlayer.value.id === data.player_id) {
                inspectedPlayer.value = null;
            }
        } else if (data.type === 'player_left_map') {
            // Remove player if they left OUR current map
            if (player.value && data.map_id === player.value.current_map_id) {
                mapPlayers.value = mapPlayers.value.filter(p => p.id !== data.player_id);
            }
        }
    };

    socket.value.onclose = () => {
        addLog('Disconnected from server.', 'text-red-500');
        socket.value = null;
        stopAutoFarm();
    };
};

const handleCombatUpdate = async (data) => {
    // Only process updates for the local player
    if (data.player_id !== player.value.id) return;

    if (player.value && data.player_hp !== undefined) {
        player.value.stats.hp = data.player_hp;
    }

    if (data.monster_hp > 0) {
        // Prevent opening/updating card if we are moving/running away
        // Check case-insensitive state AND local input authority
        const pState = (player.value.state || '').toUpperCase();

        // FORCE CLOSE if manually moving, regardless of previous state
        if (isManuallyMoving.value) {
            currentMonster.value = null;
            return;
        }

        // Only auto-open card if we are strictly in combat state
        if (!currentMonster.value && pState !== 'COMBAT' && pState !== 'ATTACKING') return;

        if (!currentMonster.value) {
            // Try to find full details
            let fullMonster = null;
            if (data.monster_id) {
                fullMonster = mapMonsters.value.find(m => m.id === data.monster_id);
            }

            currentMonster.value = {
                name: data.monster_name || (fullMonster ? fullMonster.name : "Enemy"),
                hp: data.monster_hp,
                max_hp: data.monster_max_hp || (fullMonster ? fullMonster.stats.max_hp : 50),
                level: fullMonster ? fullMonster.level : 1,
                id: data.monster_id // Store ID to track
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

    // Update map monster HP
    if (data.monster_id && data.monster_hp !== undefined) {
        const m = mapMonsters.value.find(m => m.id === data.monster_id);
        if (m && m.stats) {
            m.stats.hp = data.monster_hp;
        }
    }

    if (log.next_level_xp) player.value.next_level_xp = log.next_level_xp;
    if (log.player_dmg) addLog(`You hit monster for ${log.player_dmg} dmg.`, 'text-blue-300');
    if (log.monster_dmg) addLog(`Monster hit you for ${log.monster_dmg} dmg.`, 'text-red-300');
    if (log.monster_died) {
        addLog(`Monster died! Gained ${log.xp_gained} XP.`, 'text-yellow-400');

        // NEW ALERTS
        if (log.xp_gained > 0) addAlert(`${log.xp_gained} XP`, 'exp');
        if (log.gold_gained > 0) addAlert(`${log.gold_gained} Gold`, 'gold');

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

        // Use for...of to handle async operations sequentially
        for (const drop of data.drops) {
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
                        if (dropRarityVal < equippedRarityVal) {
                            await api.sellItem(drop.id);
                            // Combine notifications
                            addAlert(`Auto-Sold: ${drop.name}`, 'warning', '💰', 'Inferior Rarity');
                            sold = true;
                        }
                        // Rule: If same rarity (Common/Uncommon only), sell if inferior Power Score
                        else if (dropRarityVal === equippedRarityVal && drop.power_score <= equipped.power_score) {
                            await api.sellItem(drop.id);
                            addAlert(`Auto-Sold: ${drop.name}`, 'warning', '💰', 'Inferior Stats');
                            sold = true;
                        }
                    }
                }
            }

            if (!sold) {
                const icon = getItemIcon(drop);
                // addAlert(message, type, icon, subtext, rarity)
                addAlert(drop.name, 'drop', icon, `x${drop.quantity || 1}`, drop.rarity);
            }
        }
    }

    if (log.level_up) {
        addLog(`Level Up! You are now level ${log.new_level}.`, 'text-yellow-400 font-bold');
        addAlert(`Level ${log.new_level}`, 'levelup', '🆙', 'Level Up!');
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

export const getItemIcon = (item) => {
    if (item.icon && item.icon !== '📦') return item.icon;
    if (item.type === 'weapon') return '⚔️';
    if (item.type === 'armor') return '🛡️';
    if (item.type === 'consumable') return '🧪';
    if (item.type === 'material') return '🪵';
    return '📦';
};
