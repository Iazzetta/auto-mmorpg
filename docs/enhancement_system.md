# Equipment Enhancement System

## Overview
A system allowing players to upgrade Rare, Epic, and Legendary equipment using a new "Catalyst" item. The system features progressive difficulty, configurable success rates, and "Awakening" milestones.

## Mechanics

### 1. Catalyst Item
*   **Type**: `material` (subtype `catalyst`).
*   **Function**: Consumed to upgrade equipment.
*   **Storage**: Stacks in inventory.

### 2. Enhancement Rules
*   **Eligibility**: Items with Rarity >= `RARE`.
*   **Level Requirement**: Player Level 20+ to access the "Improve" tab.
*   **Progression**: Items start at Level 0 (display as `+0`). Max level is determined by config (e.g., +12 or +15).

### 3. Success & Failure Logic
| Level Range | Success Rate | On Success | On Failure |
|:-----------:|:------------:|:----------:|:----------:|
| +1 to +3 | 100% | +1 Level, 100% Cost Consumed | - |
| +4 to +6 | 85% | +1 Level, 100% Cost Consumed | 50% Cost Consumed (Refunding half materials) |
| +7 to +9 | 75% | +1 Level, 100% Cost Consumed | 50% Cost Consumed |
| +10+ | 65% | +1 Level, 100% Cost Consumed | 50% Cost Consumed |

*Note: The "50% Cost Consumed" on failure implies the player keeps half the catalysts they would have spent.*

### 4. Stat Bonuses
*   **Base Stats**: Successfully upgrading an item increases its base stats (Atk, Def, HP, etc.) by a configurable percentage (3% - 10%) per level. This is cumulative (compound or linear, configurable).
*   **Awakening (Milestones)**: At levels **+3, +6, +9**, there is a chance to unlock an "Awakening" bonus (e.g., +Crit Rate, +Extra Def).

## Configuration (World Editor)
A new "Enhancement" tab in the World Editor will allow configuration of:
1.  **Success Rates**: Per level bracket.
2.  **Costs**: Base catalyst cost per item rarity.
3.  **Bonus Multipliers**: Stat increase per level (e.g., 5%).
4.  **Failure Penalty**: % of catalysts consumed on failure (default 50%).

## User Interface

### Inventory / Bag
*   **Tabs**:
    *   **Bag**: Standard inventory.
    *   **Improve**: Enhancement interface (Locked < Lv 20).
    *   *(Future tabs like Crafting?)*

### "Improve" Tab Layout
*   **Left Column (Action Area)**:
    *   **Slot**: Empty placeholder for target item.
    *   **Cost Display**: Shows required Catalysts vs Owned. Red text if insufficient.
    *   **Button**: "Improve" (Disabled if insufficient cost/level).
    *   **Info**: Display Success Rate and potential stat gain.
*   **Right Column (Selection Area)**:
    *   Grid of upgradeable items (Rare+ only) from inventory/equipment.
    *   Clicking an item moves it to the Left Slot.

## Security
*   **Server-Side Validation**:
    *   Verify player level.
    *   Verify item eligibility.
    *   Verify catalyst ownership.
    *   Calculate rng result server-side.
    *   Apply changes atomically.
