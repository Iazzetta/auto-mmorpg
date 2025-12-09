from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import List
from .app.api.routes import router
from .app.api.editor import router as editor_router
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
app.include_router(editor_router)

from fastapi.staticfiles import StaticFiles
import os

# Mount maps directory to serve textures
# We assume the code runs from repository root
if os.path.exists("client/public/maps"):
    app.mount("/maps", StaticFiles(directory="client/public/maps"), name="maps")
else:
    print("Warning: client/public/maps not found")

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
    state_manager.connection_manager = manager
    
    # Start Game Loop
    logger.info("Starting Game Loop...")
    asyncio.create_task(game_loop.start())
    
    # Persistence
    from .app.services.persistence_service import PersistenceService
    persistence = PersistenceService.get_instance()
    persistence.load_players()
    asyncio.create_task(persistence.save_players_loop())
    
    # Data is loaded by StateManager on init

import json

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    state_manager.mark_player_online(client_id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                if data.get("type") == "chat":
                    player = state_manager.get_player(client_id)
                    name = player.name if player else "Unknown"
                    await manager.broadcast({
                        "type": "chat", 
                        "player_id": client_id,
                        "name": name,
                        "message": data.get("message")
                    })
            except Exception:
                pass
            
    except WebSocketDisconnect:
        await state_manager.remove_player(client_id)
        manager.disconnect(websocket)
