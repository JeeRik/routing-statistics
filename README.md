# routing-statistics

Visualization tool for the **Routing Game** — a physical scouting/camp game where players build a rocket by transporting materials across a network of factory stations.

Reads NFC scan logs from a SQLite database and renders them as an interactive network map with replay controls.

---

## Features

- **Network map** — stations as nodes, paths as draggable arcs; fully rearrangeable layout persisted per round
- **Replay** — scrub or play through a recorded game session; stock levels update on each station as you advance
- **Sidebar** — round selector with custom names, layer toggles (Storage / Taxed / Traffic)
- **Grid snap** — hold Ctrl while dragging a node to snap to a grid sized 2× the largest node
- **Persistent layout** — node positions, edge arc shapes, and custom round names are saved to `layout/<round_id>.json`

---

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Backend  | Python · FastAPI · uvicorn        |
| Database | SQLite (read-only via `sqlite3`)  |
| Frontend | React 18 · TypeScript · Vite      |
| Graph    | React Flow                        |

---

## Getting started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev        # proxies /api → localhost:8000
```

Open [http://localhost:5173](http://localhost:5173).

### Frontend (production build)

```bash
cd frontend && npm run build
# FastAPI will serve frontend/dist/ at http://localhost:8000
```

---

## Data

Place the SQLite log file at:

```
data/game-logs-YYYY-MM-DD.sqlite3
```

Update the path in [`backend/db.py`](backend/db.py) if the filename differs.

**Round 21** is the real game session (~9 660 events). Rounds 42 and 123 are dev/test data.

---

## Layout files

Node positions, edge arc offsets, and custom round names are stored in `layout/<round_id>.json`. These files are committed so layouts survive a fresh clone.
