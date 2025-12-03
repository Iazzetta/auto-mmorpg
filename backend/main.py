from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import List
from .app.api.routes import router
from .app.engine.game_loop import GameLoop
from .app.engine.state_manager import StateManager
from .app.models.monster import Monster, MonsterType, MonsterStats
from .app.core.logger import logger

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

game_loop = GameLoop()
state_manager = StateManager.get_instance()

# Simple Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    # Inject manager into GameLoop
    game_loop.set_connection_manager(manager)
    
    # Start Game Loop
    logger.info("Starting Game Loop...")
    asyncio.create_task(game_loop.start())
    
    # Initialize some dummy data
    # Load initial spawns
    from .app.data.monsters import SPAWNS, MONSTERS
    import uuid
    
    for map_id, spawns in SPAWNS.items():
        for spawn in spawns:
            template = MONSTERS.get(spawn['template_id'])
            if template:
                monster = Monster(
                    id=f"{spawn['template_id']}_{uuid.uuid4().hex[:8]}",
                    template_id=spawn['template_id'],
                    name=template['name'],
                    level=template['level'],
                    m_type=template['m_type'],
                    stats=template['stats'].copy(),
                    map_id=map_id,
                    position_x=spawn['x'],
                    position_y=spawn['y'],
                    xp_reward=template['xp_reward']
                )
                state_manager.add_monster(monster)

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            # We can receive commands here too, but for now just keep connection open
            data = await websocket.receive_text()
            # Simple debug echo
            await manager.broadcast({"message": f"Client {client_id} says: {data}"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
