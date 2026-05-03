# routing-statistics

Visualization tool for the **Routing Game** — a physical scouting/camp game where players build a rocket by transporting materials across a network of factory stations.

Reads NFC scan logs from a SQLite database and renders them as an interactive network map with replay controls.

---

## Features

- **Rounds list** — `/rounds` page with a table of all recorded sessions (name, topology, event count, duration); names are editable inline
- **Network map** — stations as nodes, paths as draggable arcs; fully rearrangeable layout persisted per round
- **Replay** — scrub or play through a recorded game session; stock levels update on each station as you advance
- **Supply layer** — Storage checkbox adds a row to every node showing factory inputs (left) and output (right); each badge has a solid material-color border with a bottom-to-top fill from black (empty) to full color (30 units); hover a badge to see the full delivery history (time · amount · truck card ID) up to the current replay time
- **Cargo layer** — Cargo checkbox overlays truck bubbles on each station showing all non-empty trucks currently docked there (up to 4 per row); hover a bubble to see the truck's full scan history (time · node · cargo) up to the current replay time
- **Process popover** — hover over a node's name to see its factory recipe (e.g. `[blue] + [yellow] → [gray]`) and how many items it has produced so far at the current replay time
- **Sidebar** — round stats and layer toggles (Storage / Cargo / Taxed / Traffic)
- **Grid snap** — hold Ctrl while dragging a node to snap to a 160 px grid
- **Space to play/pause** — keyboard shortcut to toggle replay playback from anywhere on the page
- **Persistent layout** — node positions, edge arc shapes, and custom round names are saved to `layout/<round_id>.json`

---

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Backend  | Python 3.12 · FastAPI · uvicorn   |
| Database | SQLite (read-only via `sqlite3`)  |
| Frontend | React 19 · TypeScript · Vite      |
| Graph    | React Flow 11                     |
| Routing  | React Router v7                   |

---

## Getting started

### Backend

```bash
cd backend
py -3.12 -m pip install -r requirements.txt
py -3.12 -m uvicorn main:app --reload --port 8000
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev        # proxies /api → localhost:8000
```

Open [http://localhost:5173](http://localhost:5173) — redirects to `/rounds`.

### Quick restart (PowerShell)

```powershell
.\dev.ps1           # stop + restart both servers in new windows
.\dev.ps1 stop      # stop only
.\dev.ps1 start     # start only
```

### Frontend (production build)

```bash
cd frontend && npm run build
# FastAPI will serve frontend/dist/ at http://localhost:8000
```

---

## Data

The SQLite log file is committed at:

```
data/game-logs-2026-03-26.sqlite3
```

Update the path in [`backend/db.py`](backend/db.py) if the filename differs.

**Round 21** is the real game session (~9 660 events). Rounds 42 and 123 are dev/test data.

---

## Layout files

Node positions, edge arc offsets, and custom round names are stored in `layout/<round_id>.json`. These files are committed so layouts survive a fresh clone.
