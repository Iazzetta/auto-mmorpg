# Game Mechanics

## Attributes & Stats
Players have 4 primary attributes that influence derived stats:

| Attribute | Effect |
|-----------|--------|
| **STR (Strength)** | +2 Attack |
| **AGI (Agility)** | +1 Attack, +1 Defense, +0.02 Speed |
| **VIT (Vitality)** | +10 Max HP, +1 Defense |
| **INT (Intelligence)** | (Planned: Magic Atk/Def) |

### Derived Stats
*   **HP**: Health Points. Death occurs at 0.
*   **ATK**: Physical damage output.
*   **DEF**: Damage mitigation.
*   **SPD**: Movement speed (affects map travel time).
*   **CP (Combat Power)**: Rough estimate of strength. Formula: `Atk + Def + (MaxHP / 10)`.

## Combat System
*   **Tick-Based**: Combat occurs in rounds processed by the server loop.
*   **Damage Formula**: `Damage = Attacker.Atk - (Defender.Def / 2)`. Minimum damage is 1.
*   **Level Up**: XP required = `Current Level * 100`. Awards **5 Attribute Points** and full HP restore.

## Items & Inventory
*   **Rarity**: Common (Gray), Uncommon (Green), Rare (Purple), Epic (Red), Legendary (Gold).
*   **Slots**: Head, Chest, Legs, Boots, Main Hand, Off Hand.
*   **Stacking**: Consumables (Potions) stack. Equipment does not.
*   **Power Score (PS)**: Sum of item's stat bonuses.

## Maps & Movement
*   **Coordinate System**: Abstract 0-100 grid for simplicity.
*   **Portals**: Located at map edges (e.g., x=0 or x=100) to transition between zones (Castle <-> Forest).
*   **Movement**:
    *   **Server**: Validates move requests and updates coordinates.
    *   **Client**: Interpolates position (`lerp`) for smooth visual movement on Canvas.

## Missions
*   **Structure**: `Target Monster ID` + `Count`.
*   **Progress**: Increments on monster death if `active_mission_id` matches.
*   **Rewards**: XP and Gold upon manual claim.
