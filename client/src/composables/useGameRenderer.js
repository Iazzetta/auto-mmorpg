
import { ref, watch, onUnmounted } from 'vue';
import * as THREE from 'three';
import { currentMapData, player, mapMonsters, mapPlayers, mapNpcs } from '../state.js';
import { API_BASE_URL } from '../config.js';

export function useGameRenderer() {
    const container = ref(null);
    const minimapCanvas = ref(null);
    const cameraZoom = ref(10);

    // Core Three.js Objects
    let scene = new THREE.Scene();
    let camera = null;
    let renderer = null;
    let groundPlane = null;

    // Resources
    const geometries = {
        player: new THREE.BoxGeometry(1, 2, 1),
        monster: new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16),
        portal: new THREE.TorusGeometry(1, 0.2, 8, 16),
        npc: new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
        res_box: new THREE.BoxGeometry(1, 1, 1),
        res_tree: new THREE.CylinderGeometry(0.2, 0.8, 4, 8),
        res_rock: new THREE.DodecahedronGeometry(0.8, 0),
        res_flower: new THREE.OctahedronGeometry(0.4, 0),
    };

    const materials = {
        player: new THREE.MeshStandardMaterial({ color: 0x22c55e }),
        otherPlayer: new THREE.MeshStandardMaterial({ color: 0x3b82f6 }),
        monster: new THREE.MeshStandardMaterial({ color: 0xef4444 }),
        npc: new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
        resource: new THREE.MeshStandardMaterial({ color: 0xffffff }),
    };

    const initThree = () => {
        if (!container.value) return;

        const width = container.value.clientWidth;
        const height = container.value.clientHeight;

        // 1. Scene
        scene.background = new THREE.Color(0x111827); // Dark gray

        // 2. Camera (Orthographic)
        const aspect = width / height;
        const d = cameraZoom.value;
        camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        camera.position.set(20, 20, 20);
        camera.lookAt(scene.position);

        // 3. Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = false;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.value.appendChild(renderer.domElement);

        // 4. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 50, 0);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // 5. Ground
        const geometry = new THREE.PlaneGeometry(100, 100);
        const defaultMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
        groundPlane = new THREE.Mesh(geometry, defaultMat);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(50, 0, 50);
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);

        // Grid
        const gridHelper = new THREE.GridHelper(100, 10, 0x374151, 0x374151);
        gridHelper.position.set(50, 0.01, 50);
        scene.add(gridHelper);

        // Events
        window.addEventListener('resize', onWindowResize);
    };

    const onWindowResize = () => {
        if (!container.value || !camera || !renderer) return;
        const width = container.value.clientWidth;
        const height = container.value.clientHeight;
        const aspect = width / height;
        const d = cameraZoom.value;

        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };

    // Watchers for Ground Texture
    watch(() => currentMapData.value, (newData) => {
        if (!groundPlane) return;

        const defaultMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, side: THREE.DoubleSide });

        if (newData && newData.texture) {
            const loader = new THREE.TextureLoader();
            loader.load(`${API_BASE_URL}/maps/floor/${newData.texture}`, (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;

                const sizeFactor = newData.texture_scale || 10;
                const repeats = 100 / Math.max(1, sizeFactor);
                tex.repeat.set(repeats, repeats);

                const newMat = new THREE.MeshStandardMaterial({
                    map: tex,
                    side: THREE.DoubleSide,
                    roughness: 0.8,
                    metalness: 0.2
                });
                groundPlane.material = newMat;
                groundPlane.material.needsUpdate = true;
            }, undefined, (err) => {
                console.error("Error loading floor texture:", err);
                groundPlane.material = defaultMat;
            });
        } else {
            groundPlane.material = defaultMat;
        }
    }, { deep: true });

    // Minimap
    const drawMinimap = (meshes) => {
        if (!minimapCanvas.value || !player.value) return;
        const ctx = minimapCanvas.value.getContext('2d');
        const w = minimapCanvas.value.width;
        const h = minimapCanvas.value.height;

        // Background
        ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
        ctx.fillRect(0, 0, w, h);

        const scale = w / 100; // Map Size 100x100

        const drawDot = (x, z, color, size = 2) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x * scale, z * scale, size, 0, Math.PI * 2);
            ctx.fill();
        };

        // Entities
        if (currentMapData.value?.resources) {
            currentMapData.value.resources.forEach(r => drawDot(r.x, r.y, '#0ea5e9', 1.5));
        }
        if (currentMapData.value?.portals) {
            currentMapData.value.portals.forEach(p => drawDot(p.x, p.y, '#d8b4fe', 3));
        }
        mapMonsters.value.forEach(m => {
            if (m.stats?.hp > 0) drawDot(m.position_x, m.position_y, '#ef4444', 2);
        });
        if (mapNpcs.value) {
            mapNpcs.value.forEach(n => drawDot(n.x, n.y, '#facc15', 2.5));
        }
        mapPlayers.value.forEach(p => {
            if (p.id !== player.value.id) drawDot(p.position.x, p.position.y, '#60a5fa', 2);
        });

        // Self
        if (player.value?.position) {
            drawDot(player.value.position.x, player.value.position.y, '#4ade80', 3);

            // Direction
            const rot = meshes.get(player.value.id)?.rotation.y || 0;
            ctx.beginPath();
            ctx.moveTo(player.value.position.x * scale, player.value.position.y * scale);
            ctx.lineTo(
                (player.value.position.x + Math.sin(rot) * 5) * scale,
                (player.value.position.y + Math.cos(rot) * 5) * scale
            );
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    };

    onUnmounted(() => {
        window.removeEventListener('resize', onWindowResize);
        if (renderer && container.value) {
            renderer.dispose();
            if (container.value.contains(renderer.domElement)) {
                container.value.removeChild(renderer.domElement);
            }
        }
    });

    // toScreenPosition Helper
    const tempVec = new THREE.Vector3();
    const toScreenPosition = (obj, offsetY = 0) => {
        if (!container.value || !camera) return { x: 0, y: 0 };

        obj.updateMatrixWorld();
        tempVec.setFromMatrixPosition(obj.matrixWorld);

        // Default offsets if no explicit offset provided
        if (offsetY === 0) {
            const type = obj.userData.type;
            offsetY = type === 'player' ? 4.0 : (type === 'portal' ? 3.0 : (type === 'npc' ? 3.2 : 2.5));
        }
        tempVec.y += offsetY;

        tempVec.project(camera);

        const widthHalf = 0.5 * container.value.clientWidth;
        const heightHalf = 0.5 * container.value.clientHeight;

        return {
            x: (tempVec.x * widthHalf) + widthHalf,
            y: -(tempVec.y * heightHalf) + heightHalf
        };
    };

    return {
        container,
        minimapCanvas,
        cameraZoom,
        scene,
        getCamera: () => camera,
        getRenderer: () => renderer,
        geometries,
        materials,
        initThree,
        drawMinimap,
        onWindowResize,
        toScreenPosition
    };
}
