import { ref, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, mapMonsters, mapPlayers, destinationMarker, currentMonster, addLog, selectedTargetId, isFreeFarming, pendingAttackId, inspectedPlayer } from '../state.js';
import { api } from '../services/api.js';
import { stopAutoFarm, checkAndAct } from '../services/autoFarm.js';

export default {
    template: `
        <div class="absolute top-14 bottom-0 w-full bg-gray-950 overflow-hidden">
            <!-- Map Info -->
            <div class="absolute top-4 left-4 text-xs text-gray-500 font-mono z-10 bg-black/50 px-2 py-1 rounded pointer-events-none">
                MAP: {{ formatMapName(player?.current_map_id) }} | {{ Math.round(player?.position?.x || 0) }}, {{ Math.round(player?.position?.y || 0) }}
            </div>

            <!-- Canvas -->
            <canvas ref="mapCanvas" class="w-full h-full cursor-crosshair block" @click="handleMapClick"></canvas>

            <!-- Enemy Status Overlay -->
            <div v-if="currentMonster"
                class="absolute top-16 right-4 bg-gray-800 p-2 rounded border border-red-900 shadow-xl z-20 w-48 pointer-events-none">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-red-400 text-xs truncate">{{ currentMonster.name }}</span>
                    <span class="text-xs text-gray-400">{{ currentMonster.hp }}/{{ currentMonster.max_hp }}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div class="bg-red-600 h-full transition-all duration-300"
                        :style="{ width: (currentMonster.hp / currentMonster.max_hp * 100) + '%' }"></div>
                </div>
            </div>

            <!-- Interaction Button -->
            <div v-if="canEnterPortal && !isFreeFarming" class="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-50">
                <button @click="confirmPortal" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-full shadow-lg border-2 border-blue-400 animate-bounce">
                    Enter Portal (F)
                </button>
            </div>
        </div>
    `,
    setup() {
        const mapCanvas = ref(null);
        const playerVisualPos = ref({ x: 0, y: 0 });
        let frameCount = 0;
        let lastFpsTime = performance.now();
        const fps = ref(0);

        // Camera Settings
        const ZOOM = 0.8;
        const GAME_SCALE = 40; // 1 game unit = 40 pixels. Map 100x100 = 4000x4000px.
        const keys = { w: false, a: false, s: false, d: false };
        let lastMoveTime = 0;

        const currentMapData = ref(null);

        const canEnterPortal = ref(false);
        const pendingPortal = ref(null);

        const formatMapName = (id) => {
            if (!id) return '';
            return id.replace('map_', '').replace('_', ' ').toUpperCase();
        };

        const handleKeyDown = (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = true;
            if (e.key === 'a' || e.key === 'A') keys.a = true;
            if (e.key === 's' || e.key === 'S') keys.s = true;
            if (e.key === 'd' || e.key === 'D') keys.d = true;
            if (e.key === 'f' || e.key === 'F') {
                if (canEnterPortal.value) confirmPortal();
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = false;
            if (e.key === 'a' || e.key === 'A') keys.a = false;
            if (e.key === 's' || e.key === 'S') keys.s = false;
            if (e.key === 'd' || e.key === 'D') keys.d = false;
        };

        const checkPortals = () => {
            if (!player.value || !currentMapData.value) return;
            const p = player.value.position;

            let closestDist = 999;
            let closestPortal = null;

            if (currentMapData.value.portals) {
                for (const portal of currentMapData.value.portals) {
                    const dist = Math.sqrt((p.x - portal.x) ** 2 + (p.y - portal.y) ** 2);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPortal = portal;
                    }
                }
            }

            if (closestPortal && closestDist < 1.5) {
                pendingPortal.value = {
                    name: closestPortal.label || 'Portal',
                    targetMap: closestPortal.target_map_id,
                    x: closestPortal.target_x,
                    y: closestPortal.target_y
                };
                canEnterPortal.value = true;

                // Auto-enter if free farming (mission/auto)
                if (isFreeFarming.value) {
                    console.log("Auto-entering portal because isFreeFarming is true");
                    confirmPortal();
                }
            } else {
                canEnterPortal.value = false;
                pendingPortal.value = null;
            }
        };

        const confirmPortal = async () => {
            if (pendingPortal.value) {
                await api.movePlayer(pendingPortal.value.targetMap, pendingPortal.value.x, pendingPortal.value.y);
                canEnterPortal.value = false;
            }
        };

        const handleMapClick = async (e) => {
            if (!player.value || !mapCanvas.value) return;
            const rect = mapCanvas.value.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Convert Screen -> World -> Game
            const playerPx = playerVisualPos.value.x * GAME_SCALE;
            const playerPy = playerVisualPos.value.y * GAME_SCALE;

            // Inverse of: screen = (world - center) / ZOOM + player
            // world = (screen - center) / ZOOM + player
            const worldX = (screenX - mapCanvas.value.width / 2) / ZOOM + playerPx;
            const worldY = (screenY - mapCanvas.value.height / 2) / ZOOM + playerPy;

            const gameX = worldX / GAME_SCALE;
            const gameY = worldY / GAME_SCALE;

            // Check for players click
            for (const p of mapPlayers.value) {
                if (p.id === player.value.id) continue;
                const dist = Math.sqrt((gameX - p.position.x) ** 2 + (gameY - p.position.y) ** 2);
                if (dist < 2) { // Hitbox size in game units
                    inspectedPlayer.value = p;
                    return;
                }
            }

            // Check for monsters click
            let clickedMonster = null;
            for (const m of mapMonsters.value) {
                if (m.hp <= 0) continue;
                const dist = Math.sqrt((gameX - m.position_x) ** 2 + (gameY - m.position_y) ** 2);
                if (dist < 2) {
                    clickedMonster = m;
                    break;
                }
            }

            if (clickedMonster) {
                addLog(`Moving to attack ${clickedMonster.name}...`);
                stopAutoFarm();
                selectedTargetId.value = clickedMonster.template_id;
                isFreeFarming.value = true;

                // Move towards monster
                const angle = Math.atan2(clickedMonster.position_y - player.value.position.y, clickedMonster.position_x - player.value.position.x);
                const stopDist = 3;
                const targetX = clickedMonster.position_x - Math.cos(angle) * stopDist;
                const targetY = clickedMonster.position_y - Math.sin(angle) * stopDist;

                destinationMarker.value = { x: targetX, y: targetY, time: Date.now(), isGameCoords: true };
                await api.movePlayer(player.value.current_map_id, targetX, targetY);
                pendingAttackId.value = clickedMonster.id;
                return;
            }

            // Movement
            stopAutoFarm(); // Ensure auto-farm is stopped on manual move
            destinationMarker.value = { x: gameX, y: gameY, time: Date.now(), isGameCoords: true };
            api.movePlayer(player.value.current_map_id, gameX, gameY);

            // If mission is active, clicking might mean "resume mission" if we clicked near a target?
            // Or just manual move overrides mission.
            // User said: "sempre q clicar em uma missao ele voltar ao caminho automatico".
            // That's handled by the Mission UI button, not map click.
        };

        const updateMovement = () => {
            if (!player.value) return;
            const now = Date.now();
            if (now - lastMoveTime < 100) return; // Throttle 100ms

            let dx = 0;
            let dy = 0;
            if (keys.w) dy -= 1;
            if (keys.s) dy += 1;
            if (keys.a) dx -= 1;
            if (keys.d) dx += 1;

            if (dx !== 0 || dy !== 0) {
                stopAutoFarm(); // Manual movement stops auto farm

                // Normalize vector
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;

                const dist = 5; // Move 5 units ahead
                const targetX = player.value.position.x + dx * dist;
                const targetY = player.value.position.y + dy * dist;

                api.movePlayer(player.value.current_map_id, targetX, targetY);
                lastMoveTime = now;
            }
        };

        const drawMap = () => {
            requestAnimationFrame(drawMap);
            updateMovement();
            checkPortals();

            const canvas = mapCanvas.value;
            if (!canvas || !player.value) return;

            if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
            }

            const ctx = canvas.getContext('2d');

            // Smooth player visual position
            const px = player.value.position ? player.value.position.x : 0;
            const py = player.value.position ? player.value.position.y : 0;
            playerVisualPos.value.x += (px - playerVisualPos.value.x) * 0.2;
            playerVisualPos.value.y += (py - playerVisualPos.value.y) * 0.2;

            // Clear
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();

            // Camera Transform
            // 1. Move origin to center of screen
            ctx.translate(canvas.width / 2, canvas.height / 2);
            // 2. Scale
            ctx.scale(ZOOM, ZOOM);
            // 3. Move world so player is at origin
            ctx.translate(-playerVisualPos.value.x * GAME_SCALE, -playerVisualPos.value.y * GAME_SCALE);

            // Draw World Bounds (0,0 to 100,100)
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 2 / ZOOM; // Keep line width constant on screen
            ctx.strokeRect(0, 0, 100 * GAME_SCALE, 100 * GAME_SCALE);

            // Grid
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 1 / ZOOM;
            const gridSize = 10 * GAME_SCALE; // Grid every 10 units
            for (let x = 0; x <= 100 * GAME_SCALE; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 100 * GAME_SCALE); ctx.stroke();
            }
            for (let y = 0; y <= 100 * GAME_SCALE; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(100 * GAME_SCALE, y); ctx.stroke();
            }

            // Portals
            const drawPortal = (x, y, color, label) => {
                const cx = x * GAME_SCALE;
                const cy = y * GAME_SCALE;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(cx, cy, 1.5 * GAME_SCALE, 0, Math.PI * 2); // Portal radius 1.5 units
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = `${12 / ZOOM}px sans-serif`; // Scale font inverse to zoom? Or just small
                ctx.textAlign = 'center';
                ctx.fillText(label, cx, cy + 2 * GAME_SCALE);
            };

            if (currentMapData.value && currentMapData.value.portals) {
                currentMapData.value.portals.forEach(portal => {
                    let displayLabel = portal.label;
                    if (!displayLabel || displayLabel === 'Portal') {
                        displayLabel = formatMapName(portal.target_map_id) || 'PORTAL';
                    }
                    drawPortal(portal.x, portal.y, portal.color || '#fff', displayLabel);
                });
            }

            // Monsters
            mapMonsters.value.forEach(m => {
                if (m.hp <= 0) return;
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                const mx = m.position_x * GAME_SCALE;
                const my = m.position_y * GAME_SCALE;
                ctx.arc(mx, my, 0.5 * GAME_SCALE, 0, Math.PI * 2); // Radius 0.5 units
                ctx.fill();

                // Name
                ctx.fillStyle = '#9ca3af';
                ctx.font = `${10 / ZOOM}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(m.name, mx, my - 0.8 * GAME_SCALE);

                // HP Bar
                ctx.fillStyle = '#374151';
                ctx.fillRect(mx - 1 * GAME_SCALE, my - 1.2 * GAME_SCALE, 2 * GAME_SCALE, 0.3 * GAME_SCALE);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(mx - 1 * GAME_SCALE, my - 1.2 * GAME_SCALE, (m.hp / m.max_hp) * 2 * GAME_SCALE, 0.3 * GAME_SCALE);
            });

            // Other Players
            mapPlayers.value.forEach(p => {
                if (p.id === player.value.id) return;
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                const px = p.position.x * GAME_SCALE;
                const py = p.position.y * GAME_SCALE;
                ctx.arc(px, py, 0.5 * GAME_SCALE, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = `${10 / ZOOM}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(p.name, px, py - 0.8 * GAME_SCALE);
            });

            // Destination Marker
            if (destinationMarker.value) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2 / ZOOM;
                let mx, my;
                if (destinationMarker.value.isGameCoords) {
                    mx = destinationMarker.value.x * GAME_SCALE;
                    my = destinationMarker.value.y * GAME_SCALE;
                } else {
                    // Legacy support or ignore
                    mx = 0; my = 0;
                }

                ctx.beginPath();
                const s = 0.5 * GAME_SCALE;
                ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s);
                ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s);
                ctx.stroke();
            }

            // Local Player
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            const lpx = playerVisualPos.value.x * GAME_SCALE;
            const lpy = playerVisualPos.value.y * GAME_SCALE;
            ctx.arc(lpx, lpy, 0.5 * GAME_SCALE, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${12 / ZOOM}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(player.value.name, lpx, lpy - 0.8 * GAME_SCALE);

            ctx.restore();

            // FPS (Screen Space)
            const now = performance.now();
            frameCount++;
            if (now - lastFpsTime >= 1000) {
                fps.value = frameCount;
                frameCount = 0;
                lastFpsTime = now;
            }
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(canvas.width - 60, 0, 60, 20);
            ctx.fillStyle = '#0f0';
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`FPS: ${fps.value}`, canvas.width - 55, 14);
        };

        watch(() => player.value?.current_map_id, async (newMapId) => {
            if (newMapId) {
                api.fetchMapMonsters(newMapId);
                api.fetchMapPlayers(newMapId);

                // Fetch Map Data
                try {
                    const res = await fetch(`http://localhost:8000/map/${newMapId}`);
                    if (res.ok) currentMapData.value = await res.json();
                } catch (e) { console.error(e); }

                setTimeout(checkAndAct, 500); // Wait a bit for state to settle
            }
        }, { immediate: true });

        onMounted(() => {
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            if (player.value?.current_map_id) {
                api.fetchMapMonsters(player.value.current_map_id);
                api.fetchMapPlayers(player.value.current_map_id);
            }
            requestAnimationFrame(drawMap);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        });

        return {
            mapCanvas,
            player,
            currentMonster,
            handleMapClick,
            formatMapName,
            canEnterPortal,
            confirmPortal,
            isFreeFarming
        };
    }
};
