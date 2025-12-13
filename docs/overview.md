# AIM Online - Project Overview

## Introduction
AIM Online is a **3D Multiplayer Online Role Playing Game (MMORPG)** that runs in the browser. It combines classic RPG elements (Exploration, Combat, Loot) with modern "idle" mechanics (Auto-Farm) and a dynamic 3D world built with Three.js.

## Core Gameplay Loop
1.  **Create Hero**: Register a new account and choose a class (Warrior is the primary class with custom 3D models).
2.  **Exploration**:
    *   **3D World**: Freely explore different maps (Forest, Castle, etc.).
    *   **Controls**: Use **WASD** to move your character or Click-to-Move.
    *   **Portals**: Travel between zones by interacting with portals.
3.  **Combat**:
    *   **Manual**: Click on a monster to target and attack it.
    *   **Auto-Farm**: Toggle "Auto Attack" (Hotbar Button) to automatically target nearby enemies and farm XP/Loot.
    *   **Visuals**: Animated attacks, damage numbers, and floating health bars.
4.  **Social**:
    *   **Multiplayer**: See other players move and fight in real-time.
    *   **Chat**: Global chat system to communicate with other players.
    *   **Inspect**: View other players' equipment and stats.
5.  **Progression**:
    *   **Level Up**: Gain XP to unlock attribute points.
    *   **Attributes**: Custozime Strength, Agility, Vitality, Intelligence.
    *   **Loot**: Collect items, equip weapons/armor, and use consumables.

## Key Features
*   **3D Graphics**: Fully 3D isometric view using Three.js with shadows, animations (FBX), and particle effects.
*   **Real-time Multiplayer**: Powered by WebSockets for instant synchronization of position, chat, and combat.
*   **Persistence**: Player data (Level, Inventory, Position) is saved/loaded from the backend.
*   **World Editor**: Built-in tool to modify terrain, place monsters, and design missions.
*   **Reactive UI**: Fast, responsive interface built with Vue.js and TailwindCSS.
