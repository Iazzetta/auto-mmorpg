import { ref, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { player, mapMonsters, destinationMarker, currentMonster, addLog, selectedTargetId, isFreeFarming, pendingAttackId } from '../state.js';
import { api } from '../services/api.js';
import { stopAutoFarm } from '../services/autoFarm.js';

export default {
    template: `
        <div class="absolute top-14 bottom-20 w-full bg-gray-950 overflow-hidden">
            <!-- Map Info -->
            <div class="absolute top-4 left-4 text-xs text-gray-500 font-mono z-10 bg-black/50 px-2 py-1 rounded">
                MAP: {{ formatMapName(player?.current_map_id) }}
            </div>

            <!-- Canvas -->
            <canvas ref="mapCanvas" class="w-full h-full cursor-crosshair block" @click="handleMapClick"></canvas>

            <!-- Enemy Status Overlay -->
            <div v-if="currentMonster"
                class="absolute top-16 right-4 bg-gray-800 p-2 rounded border border-red-900 shadow-xl z-20 w-48">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-red-400 text-xs truncate">{{ currentMonster.name }}</span>
                    <span class="text-xs text-gray-400">{{ currentMonster.hp }}/{{ currentMonster.max_hp }}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div class="bg-red-600 h-full transition-all duration-300"
                        :style="{ width: (currentMonster.hp / currentMonster.max_hp * 100) + '%' }"></div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const mapCanvas = ref(null);
        const playerVisualPos = ref({ x: 0, y: 0 });
        let frameCount = 0;
        let lastFpsTime = performance.now();
        const fps = ref(0);

        const formatMapName = (id) => {
            if (!id) return '';
            return id.replace('map_', '').replace('_', ' ').toUpperCase();
        };

        const handleMapClick = async (e) => {
            if (!player.value || !mapCanvas.value) return;
            const rect = mapCanvas.value.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check for monsters click
            let clickedMonster = null;
            for (const m of mapMonsters.value) {
                if (m.hp <= 0) continue;
                const mx = (m.position_x / 100) * mapCanvas.value.width;
                const my = (m.position_y / 100) * mapCanvas.value.height;
                const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
                if (dist < 20) {
                    clickedMonster = m;
                    break;
                }
            }

            if (clickedMonster) {
                addLog(`Moving to attack ${clickedMonster.name}...`);
                stopAutoFarm();
                selectedTargetId.value = clickedMonster.template_id;
                isFreeFarming.value = true;

                const clickGameX = (x / mapCanvas.value.width) * 100;
                const clickGameY = (y / mapCanvas.value.height) * 100;
                const angle = Math.atan2(clickGameY - player.value.position.y, clickGameX - player.value.position.x);
                const stopDist = 4;
                const targetX = clickGameX - Math.cos(angle) * stopDist;
                const targetY = clickGameY - Math.sin(angle) * stopDist;

                destinationMarker.value = { x: targetX, y: targetY, time: Date.now(), isGameCoords: true };
                await api.movePlayer(player.value.current_map_id, targetX, targetY);
                pendingAttackId.value = clickedMonster.id;
                return;
            }

            // Movement
            // Portals logic (simplified for now, just move)
            const gameX = (x / mapCanvas.value.width) * 100;
            const gameY = (y / mapCanvas.value.height) * 100;

            // Check Portals
            if (player.value.current_map_id === 'map_castle_1' && x > mapCanvas.value.width - 50) {
                addLog("Moving to Forest Portal...", "text-blue-400");
                await api.movePlayer(player.value.current_map_id, 95, 50);
            } else if (player.value.current_map_id === 'map_forest_1' && x < 50) {
                addLog("Moving to Castle Portal...", "text-blue-400");
                await api.movePlayer(player.value.current_map_id, 5, 50);
            } else {
                destinationMarker.value = { x: gameX, y: gameY, time: Date.now(), isGameCoords: true };
                api.movePlayer(player.value.current_map_id, gameX, gameY);
            }
        };

        const drawMap = () => {
            requestAnimationFrame(drawMap);
            const canvas = mapCanvas.value;
            if (!canvas || !player.value) return;

            // Resize canvas to match display size (fullscreen)
            if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
            }

            const ctx = canvas.getContext('2d');

            // Clear
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Grid
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 1;
            const gridSize = 40; // Larger grid for fullscreen
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            // Portals
            if (player.value.current_map_id === 'map_castle_1') {
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.arc(canvas.width - 20, canvas.height / 2, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '10px sans-serif';
                ctx.fillText("FOREST", canvas.width - 45, canvas.height / 2 + 4);
            } else {
                ctx.fillStyle = '#9333ea';
                ctx.beginPath();
                ctx.arc(20, canvas.height / 2, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '10px sans-serif';
                ctx.fillText("CASTLE", 40, canvas.height / 2 + 4);
            }

            // Monsters
            mapMonsters.value.forEach(m => {
                if (m.hp <= 0) return;
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                const mx = (m.position_x / 100) * canvas.width;
                const my = (m.position_y / 100) * canvas.height;
                ctx.arc(mx, my, 8, 0, Math.PI * 2); // Slightly larger
                ctx.fill();
                ctx.fillStyle = '#9ca3af';
                ctx.font = '12px sans-serif';
                ctx.fillText(m.name, mx - 15, my - 15);
            });

            // Destination Marker
            if (destinationMarker.value) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                let mx, my;
                if (destinationMarker.value.isGameCoords) {
                    mx = (destinationMarker.value.x / 100) * canvas.width;
                    my = (destinationMarker.value.y / 100) * canvas.height;
                } else {
                    mx = destinationMarker.value.x;
                    my = destinationMarker.value.y;
                }

                ctx.beginPath();
                ctx.moveTo(mx - 5, my - 5); ctx.lineTo(mx + 5, my + 5);
                ctx.moveTo(mx + 5, my - 5); ctx.lineTo(mx - 5, my + 5);
                ctx.stroke();
            }

            // Player
            const px = player.value.position ? player.value.position.x : 0;
            const py = player.value.position ? player.value.position.y : 0;
            const targetPx = (px / 100) * canvas.width;
            const targetPy = (py / 100) * canvas.height;

            playerVisualPos.value.x += (targetPx - playerVisualPos.value.x) * 0.2;
            playerVisualPos.value.y += (targetPy - playerVisualPos.value.y) * 0.2;

            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(playerVisualPos.value.x, playerVisualPos.value.y, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText("YOU", playerVisualPos.value.x - 15, playerVisualPos.value.y - 18);

            // FPS
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
            ctx.fillText(`FPS: ${fps.value}`, canvas.width - 55, 14);
        };

        watch(() => player.value?.current_map_id, (newMapId) => {
            if (newMapId) {
                api.fetchMapMonsters(newMapId);
            }
        });

        onMounted(() => {
            if (player.value?.current_map_id) {
                api.fetchMapMonsters(player.value.current_map_id);
            }
            requestAnimationFrame(drawMap);
        });

        return {
            mapCanvas,
            player,
            currentMonster,
            handleMapClick,
            formatMapName
        };
    }
};
