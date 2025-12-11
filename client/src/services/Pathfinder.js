
import { ref } from 'vue';
import { API_BASE_URL } from '../config.js';

// Graph Node: Map ID
// Edge: Portal (Target Map ID, Portal ID, Portal X, Portal Y)

export class Pathfinder {
    constructor() {
        this.worldData = null;
        this.graph = new Map(); // MapID -> [{ targetMapId, portal }]
    }

    async init() {
        // Fetch World Data if not passed
        // For now, we assume we might need to fetch it or it's passed globally.
        // Let's try to fetch it from the editor endpoint if possible, or expect it to be initialized with data.
        // Let's try to fetch it from the editor endpoint if possible, or expect it to be initialized with data.
        // Actually, importing `currentMapData` isn't enough, we need ALL maps.
        // The client usually doesn't have ALL maps loaded.
        // But for pathfinding we need the relationships.
        // We can fetch `/editor/world` if the user is admin, but regular players might not have access?
        // Wait, the game client usually knows the "World Map". 
        // Let's assume we can fetch a lightweight "world map" graph or just use `world.json` if we can import it (we can't easily import JSON in dynamic Vue without build step unless configured).
        // Best approach: A specialized API endpoint `GET /world/graph` or just use the `api.js` to get world data.
        // For this task, strict requirement: "detecte como chegar no mapa... atraves dos portais".
        // I will assume I can fetch the world data.
        // Using a hardcoded fetch to the config file location (public) or API.
        // Let's try the editor endpoint which usually serves the world.json structure.
        try {
            const res = await fetch(`${API_BASE_URL}/editor/world`);
            if (res.ok) {
                const data = await res.json();
                this.buildGraph(data);
            }
        } catch (e) {
            console.error("Pathfinder failed to load world data", e);
        }
    }

    buildGraph(data) {
        this.worldData = data;
        this.graph.clear();

        if (!data.maps) return;

        for (const [mapId, mapInfo] of Object.entries(data.maps)) {
            if (!this.graph.has(mapId)) this.graph.set(mapId, []);

            if (mapInfo.portals) {
                for (const portal of mapInfo.portals) {
                    if (portal.target_map_id) {
                        this.graph.get(mapId).push({
                            targetMapId: portal.target_map_id,
                            portal: portal
                        });
                    }
                }
            }
        }
        console.log("Pathfinder Graph Built:", this.graph);
    }

    findPath(startMapId, targetMapId) {
        if (!this.worldData) return null;
        if (startMapId === targetMapId) return [];

        // BFS
        const queue = [[startMapId]];
        const visited = new Set([startMapId]);
        const parentMap = new Map(); // mapId -> { fromMap, viaPortal }

        while (queue.length > 0) {
            const path = queue.shift();
            const currentMap = path[path.length - 1];

            if (currentMap === targetMapId) {
                // Reconstruct Path with Portals
                return this.reconstructPath(parentMap, startMapId, targetMapId);
            }

            const neighbors = this.graph.get(currentMap) || [];
            for (const edge of neighbors) {
                if (!visited.has(edge.targetMapId)) {
                    visited.add(edge.targetMapId);
                    parentMap.set(edge.targetMapId, { from: currentMap, portal: edge.portal });
                    queue.push([...path, edge.targetMapId]);
                }
            }
        }

        return null; // No path found
    }

    reconstructPath(parentMap, start, end) {
        const steps = [];
        let curr = end;
        while (curr !== start) {
            const info = parentMap.get(curr);
            if (!info) break;
            // storing the portal you need to taking FROM the 'from' map
            steps.unshift({
                mapId: info.from,
                portal: info.portal,
                targetMap: curr
            });
            curr = info.from;
        }
        return steps;
    }
}

export const pathfinder = new Pathfinder();
