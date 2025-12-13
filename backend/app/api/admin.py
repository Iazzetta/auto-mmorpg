from fastapi import APIRouter, Request, Form, Response, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from ..engine.state_manager import StateManager
import psutil
import os
import time
from datetime import datetime
import hashlib

router = APIRouter(prefix="/admin")
templates = Jinja2Templates(directory="backend/app/templates")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_current_admin(request: Request):
    """Dependency to verify admin session via cookie"""
    username = request.cookies.get("admin_user")
    if not username:
        return None
    
    # Verify if user exists and is still admin
    state = StateManager.get_instance()
    # Linear search is fine for admin panel usage
    admin_user = None
    for p in state.players.values():
        if p.name == username and p.is_admin:
            admin_user = p
            break
            
    return admin_user

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("admin/login.html", {"request": request})

@router.post("/login", response_class=HTMLResponse)
async def login_submit(request: Request, username: str = Form(...), password: str = Form(...)):
    state = StateManager.get_instance()
    
    # 1. Verify credentials
    valid_user = None
    input_hashed = hash_password(password)
    
    for p in state.players.values():
        if p.name == username:
            # Check 1: Hashed Password (Standard)
            if hasattr(p, 'password_hash') and p.password_hash == input_hashed:
                 valid_user = p
            # Check 2: Legacy Plain Password (Migration support)
            elif hasattr(p, 'password') and p.password == password:
                 valid_user = p
                 # Optional: Auto-migrate to hash here if we wanted to write back
            
            if valid_user:
                break
            
    if not valid_user:
        return templates.TemplateResponse("admin/login.html", {"request": request, "error": "Invalid username or password"})
    
    if not valid_user.is_admin:
        return templates.TemplateResponse("admin/login.html", {"request": request, "error": "User is not an administrator"})

    # Set cookie and redirect
    response = RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(key="admin_user", value=valid_user.name, httponly=True)
    return response

@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/admin/login")
    response.delete_cookie("admin_user")
    return response

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, admin = Depends(get_current_admin)):
    if not admin: return RedirectResponse("/admin/login")
    
    state = StateManager.get_instance()
    
    # Calculate stats
    online_players = sum(1 for p in state.players.values() if p.is_online)
    total_players = len(state.players)
    
    # Server Stats
    process = psutil.Process()
    cpu_usage = psutil.cpu_percent(interval=None) # System wide or process? System wide is usually more useful for VPS monitoring.
    # Actually psutil.cpu_percent() without interval is non-blocking but might be 0 first call.
    # Let's use system wide.
    sys_cpu = psutil.cpu_percent()
    sys_mem = psutil.virtual_memory().percent
    
    stats = {
        "online_players": online_players,
        "total_players": total_players,
        "cpu_usage": sys_cpu,
        "memory_usage": sys_mem
    }
    
    # Top Online Players
    online_list = [p for p in state.players.values() if p.is_online]
    # Sort by level desc
    online_list.sort(key=lambda x: x.level, reverse=True)
    top_players = online_list[:10]
    
    return templates.TemplateResponse("admin/dashboard.html", {
        "request": request, 
        "stats": stats, 
        "top_players": top_players,
        "active_page": "dashboard",
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

@router.get("/users", response_class=HTMLResponse)
async def users_list(request: Request, admin = Depends(get_current_admin)):
    if not admin: return RedirectResponse("/admin/login")
    
    state = StateManager.get_instance()
    all_users = list(state.players.values())
    
    # Sort: Online first, then new users
    all_users.sort(key=lambda x: (not x.is_online, x.name))
    
    # Prepare display data
    display_users = []
    for u in all_users:
        # Avoid breaking if some fields missing
        last_seen = "Unknown" 
        # If we had a last_login timestamp, we'd use it.
        # For now, if online show "Now", else "-"
        if u.is_online: last_seen = "Online Now"
        
        display_users.append({
            "id": u.id,
            "name": u.name,
            "is_online": u.is_online,
            "is_admin": u.is_admin,
            "stats": u.stats,
            "level": u.level,
            "exp": u.xp,
            "gold": getattr(u, 'gold', 0), # Handle if field missing
            "diamonds": getattr(u, 'diamonds', 0),
            "class_type": u.p_class,
            "last_login": last_seen
        })
        
    return templates.TemplateResponse("admin/users.html", {
        "request": request,
        "users": display_users,
        "active_page": "users"
    })

@router.get("/users/{player_id}", response_class=HTMLResponse)
async def user_detail(request: Request, player_id: str, admin = Depends(get_current_admin)):
    if not admin: return RedirectResponse("/admin/login")
    
    state = StateManager.get_instance()
    player = state.players.get(player_id)
    
    if not player:
        return RedirectResponse("/admin/users") # Or 404
        
    # Ensure optional fields exist for template
    return templates.TemplateResponse("admin/user_detail.html", {
        "request": request,
        "user": player,
        "active_page": "users"
    })

@router.post("/users/{player_id}")
async def user_update(
    request: Request, 
    player_id: str, 
    admin = Depends(get_current_admin),
    password: str = Form(None),
    is_admin: bool = Form(False), # Checkbox sends value if checked, else nothing (FastAPI handles bool form?)
    # actually checkbox: if checked='on', if not checked=missing. 
    # Better to use Request form directly or handle bool Carefully.
    gold: int = Form(...),
    diamonds: int = Form(...),
    level: int = Form(...),
    exp: int = Form(...),
    map_id: str = Form(...),
    x: float = Form(...),
    y: float = Form(...)
):
    if not admin: return RedirectResponse("/admin/login")
    
    state = StateManager.get_instance()
    player = state.players.get(player_id)
    if not player: return RedirectResponse("/admin/users")

    # Handle Checkbox: Form(...) implies required. 
    # Use request.form() to check existence of 'is_admin'
    form_data = await request.form()
    is_admin_checked = "is_admin" in form_data
    
    # Update fields
    if password and password.strip():
        player.password_hash = hash_password(password.strip())
        
    player.is_admin = is_admin_checked
    player.gold = gold
    player.diamonds = diamonds
    player.level = level
    player.xp = exp
    player.current_map_id = map_id
    player.position.x = x
    player.position.y = y
    
    # Recalculate derived stats (next_level_xp, etc)
    player.calculate_stats()
    
    # Save State
    # Assuming the game loop or StateManager saves periodically, 
    # but we can try to force save if exposed.
    # state.save_players() # Check if this method exists. Usually it's internal.
    # If not exposed, we rely on auto-save or implement it. 
    # For now, modifying memory is enough as game loop persists.
    
    return RedirectResponse(f"/admin/users/{player_id}", status_code=status.HTTP_303_SEE_OTHER)

@router.post("/users/{player_id}/delete")
async def user_delete(request: Request, player_id: str, admin = Depends(get_current_admin)):
    if not admin: return RedirectResponse("/admin/login")
    
    state = StateManager.get_instance()
    if player_id in state.players:
        del state.players[player_id]
        # Force save logic would be good here
        
    return RedirectResponse("/admin/users", status_code=status.HTTP_303_SEE_OTHER)
