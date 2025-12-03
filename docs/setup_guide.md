# Setup & Development Guide

## Prerequisites
*   Python 3.11 or higher
*   `pip` (Python Package Manager)
*   `git`

## Installation
1.  Clone the repository.
2.  Run the setup script (Mac/Linux):
    ```bash
    sh dev.sh
    ```
    *   This script creates a virtual environment, installs dependencies from `requirements.txt`, and starts both the Backend server (port 8000) and a simple Frontend file server (port 8001).

## Manual Run
If you prefer running components separately:

**Backend:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

**Frontend:**
```bash
python3 -m http.server 8001
# Then access http://localhost:8001/client/index.html
```

## Project Structure
*   `backend/`: Python server code.
*   `client/`: Frontend HTML/JS.
*   `docs/`: Project documentation.
*   `artifacts/`: Generated assets (images, plans).

## Adding Content
*   **New Items**: Edit `backend/app/data/items.py`.
*   **New Monsters**: Edit `backend/app/data/monsters.py`.
*   **New Missions**: Edit `backend/app/data/missions.py`.
