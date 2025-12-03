import math
from ..models.player import Player, PlayerState, Position
from ..models.map import GameMap

class MovementService:
    
    @staticmethod
    def move_towards_target(player: Player, target_x: float, target_y: float, dt: float):
        """
        Moves the player towards the target position based on speed and delta time.
        Returns True if reached the target.
        """
        dx = target_x - player.position.x
        dy = target_y - player.position.y
        distance = math.sqrt(dx**2 + dy**2)
        
        if distance < 1.0: # Threshold
            player.position.x = target_x
            player.position.y = target_y
            return True
            
        # Normalize direction
        dir_x = dx / distance
        dir_y = dy / distance
        
        # Calculate movement
        move_dist = player.stats.speed * dt
        
        if move_dist >= distance:
            player.position.x = target_x
            player.position.y = target_y
            return True
        else:
            player.position.x += dir_x * move_dist
            player.position.y += dir_y * move_dist
            return False

    @staticmethod
    def update_player_position(player: Player, game_map: GameMap, dt: float):
        # For this prototype, we assume simple movement towards a target monster or portal
        # If player is in MOVING state, they are moving towards something.
        # But we need a destination. For now, let's assume the client sends a "Move to (x,y)" command
        # and we store that target in the player object (we might need to add it).
        
        # Let's add a temporary target to the player model or just assume they move to (0,0) for now if no target?
        # The prompt says: "Castle -> Portal -> Forest -> Mob".
        # So the player has a destination.
        
        # We need to add 'target_position' to Player model or handle it here.
        # Let's assume we added it or we use a simple logic for now.
        pass
