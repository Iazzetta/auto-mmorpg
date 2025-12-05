# Auto RPG - Project Overview

## Introduction
Auto RPG is a browser-based, semi-idle Role Playing Game (RPG) where players create a hero, fight monsters, collect loot, and complete missions. The game features a mix of automated gameplay (auto-battler mechanics) and manual interaction (movement, attribute allocation, equipment management).

## Core Gameplay Loop
1.  **Create Hero**: Players start by choosing a name and class (Warrior, etc.).
2.  **Explore**: Players navigate between different maps (Castle, Forest, etc.) using portals or click-to-move.
3.  **Combat**:
    *   **Manual**: Click on monsters to attack them.
    *   **Auto-Farm**: The game can automatically target and attack monsters in the vicinity.
4.  **Progression**:
    *   **Level Up**: Gain XP from monsters and missions to level up.
    *   **Attributes**: Earn points to increase Strength, Agility, Vitality, and Intelligence.
    *   **Loot**: Monsters drop items (Equipment, Potions) with varying rarities.
5.  **Missions**: Accept and complete missions for extra XP and Gold rewards.

## Key Features
*   **Real-time Combat**: Combat rounds are processed on the server tick.
*   **WebSocket Updates**: The client receives real-time state updates (HP, position, logs).
*   **Interactive Map**: 3D Isometric view using Three.js with raycasting for interaction and smooth camera following.
*   **Inventory System**: Equipment slots, bag space, stackable consumables, and item rarity system.
*   **Attribute System**: Custom stat allocation affecting derived combat stats.
*   **World Editor**: In-game editor to modify maps, monsters, and missions dynamically.
*   **Persistence**: Player data is stored in memory (currently) but structured for easy database integration. World data is stored in JSON.
