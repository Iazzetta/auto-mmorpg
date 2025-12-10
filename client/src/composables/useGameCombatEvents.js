
import { ref } from 'vue';
import { api } from '../services/api.js';

export function useGameCombatEvents(toScreenPosition, meshes) {
    // Each text: { id, x, y, text, type, opacity, scale }
    const floatingTexts = ref([]);

    let textIdCounter = 0;

    const spawnText = (targetId, text, type = 'normal') => {
        const mesh = meshes.get(targetId);
        if (!mesh) return;

        // Get 2D position (slightly higher offset for damage numbers)
        // Normal offset is ~3-4. Combat text starts at ~5.0
        const screenPos = toScreenPosition(mesh, 4.5);

        // Add random scatter to avoid perfect overlap if rapid fire
        const scatterX = (Math.random() - 0.5) * 40;
        const scatterY = (Math.random() - 0.5) * 20;

        const id = ++textIdCounter;

        floatingTexts.value.push({
            id,
            x: screenPos.x + scatterX,
            y: screenPos.y + scatterY,
            text,
            type, // normal, crit, heal, lifesteal, monster_dmg
            opacity: 1,
            scale: 1,
            life: 1.0 // seconds
        });

        // Cleanup handled by animation loop or setTimeout? 
        // GameMap loop drives animation usually. Let's provide an update function.
    };

    const handleCombatUpdate = (data) => {
        const log = data.log;
        if (!log) return;

        // 1. Player Damage (White / Orange Crit) on Monster
        if (log.player_dmg > 0) {
            const type = log.player_crit ? 'crit' : 'normal';
            spawnText(data.monster_id, log.player_dmg, type);
        } else if (log.player_dmg === 0 && !log.player_heal) {
            spawnText(data.monster_id, "MISS", 'normal'); // Optional
        }

        // 2. Monster Damage (Red) on Player
        if (log.monster_dmg > 0) {
            spawnText(data.player_id, log.monster_dmg, 'monster_dmg');
        }

        // 3. Player Heal (Green)
        // Using lifesteal or potion
        if (log.player_heal > 0) {
            spawnText(data.player_id, `+${log.player_heal}`, 'heal'); // User asked for green heal
        }

        // If we want Lifesteal specifically to be "Reddish" as user asked:
        // "roubo de vida avermelhado"
        // Lifesteal IS a heal. But maybe we distinguish if it came from damage logic?
        // log['player_heal'] comes from ANY heal in combat service.
        // But user said "roubo de vida avermelhado". Standard heal "verde".
        // The backend doesn't explicitly flag "lifesteal" separately in the log keys, 
        // but checking `process_combat_round`, it sets `player_heal`.
        // If we want a separate color, we check if `player_dmg` > 0 AND `player_heal` > 0 in the same frame?
        if (log.player_heal > 0 && log.player_dmg > 0) {
            // It's likely lifesteal if it accompanies damage
            // Update the last added entry type? Or spawn a NEW one?
            // The logic above spawned a 'heal' green text.
            // Let's modify:
            const lastHeal = floatingTexts.value[floatingTexts.value.length - 1];
            if (lastHeal && lastHeal.text === `+${log.player_heal}` && lastHeal.type === 'heal') {
                lastHeal.type = 'lifesteal'; // Override to custom type
            }
        }
    };

    const updateFloatingTexts = (dt) => {
        // Animate float up and fade
        const speed = 50; // pixels per second up

        for (let i = floatingTexts.value.length - 1; i >= 0; i--) {
            const ft = floatingTexts.value[i];
            ft.life -= dt;

            ft.y -= speed * dt; // Move Up

            // Scale pop effect at start
            if (ft.life > 0.8) {
                ft.scale = 1 + (1.0 - ft.life) * 2; // 1.0 -> 1.4
            } else {
                ft.scale = 1;
            }

            if (ft.life <= 0) {
                floatingTexts.value.splice(i, 1);
            }
        }
    };

    return {
        floatingTexts,
        handleCombatUpdate,
        updateFloatingTexts
    };
}
