# Game Mechanics

## Attributes & Stats
Players have 4 primary attributes that influence derived stats:

| Attribute | Effect |
|-----------|--------|
| **STR (Strength)** | +2 Attack |
| **AGI (Agility)** | +1 Attack, +1 Defense, +0.02 Speed |
| **VIT (Vitality)** | +5 Max HP, +1 Defense |
| **INI (Intelligence)** | +0.1 Speed, Reduces Cooldown (-0.05s) |

### Derived Stats
*   **HP**: Health Points. Formula: `50 + (VIT * 5) + Equipment Bonuses`.
*   **ATK**: Physical damage output. Formula: `5 + (STR * 2) + AGI + Equipment`.
*   **DEF**: Damage mitigation. Formula: `VIT + AGI + Equipment`.
*   **SPD**: Movement speed. Formula: `20 + (INI * 0.1) + Equipment`.
*   **Cooldown**: Attack interval. Formula: `1.5s - (INI * 0.05)`. Min 0.3s.

## Combat System
*   **Tick-Based**: Combat occurs in rounds processed by the server loop (every 100ms).
*   **Damage**: `Max(1, Attacker.Atk - (Defender.Def / 2))`.
*   **Auto-Farm**: Toggleable. Automatically targets nearest monster, handles map traversal, and looting.
*   **Level Up**: XP required = `Current Level^2 * 100`. Awards **5 Attribute Points** and restores Max HP.

## Items & Equipment
*   **Rarity**: Common, Uncommon, Rare, Epic, Legendary.
*   **Slots**: Head, Chest, Legs, Boots, Main Hand, Off Hand.
*   **Stats**: Equipping items immediately updates Max HP, Atk, Def, etc.
*   **Auto-Equip**: Obtaining a better item (higher Power Score) while Auto-Farming will automatically equip it.

## Resource Gathering (Mining/Herbalism)
*   **Secure Flow**: Two-step process to prevent speed hacks.
    1.  `start_gather`: Server restricts movement and starts timer.
    2.  `gather_resource`: Client must wait `duration_ms` before claiming.
*   **Drops**: Resources drop materials used for crafting or quest delivery.

## Missions
*   **Types**:
    *   **Kill**: Eliminate N monsters of a specific type.
    *   **Collect**: Gather N items (drops or resources).
    *   **Talk**: Go to an NPC and interact.
*   **Auto-Play**: Clicking a mission tracks it and enables Auto-Pilot (moves to map/NPC/monster).
*   **Main Quest**: Always displayed at top with Gold border.

## Rewards System
*   **Types**:
    *   **One-Time**: Starter chests, promo codes.
    *   **Daily**: Claims available every 24h.
    *   **Weekly**: Claims available every 7 days.
    *   **Level**: Unlocks upon reaching specific levels.
*   **Claiming**: Grants items/currency and immediately syncs inventory/stats.
