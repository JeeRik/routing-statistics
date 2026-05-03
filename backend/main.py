import json
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).parent))

import db
from models import GameState, LayoutData, RoundDefinition, RoundSummary
from replay import compute_state

app = FastAPI(title="routing-statistics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LAYOUT_DIR = Path(__file__).parent.parent / "layout"
LAYOUT_DIR.mkdir(exist_ok=True)

# Cache events per round to avoid re-reading from DB on every /state request
_event_cache: dict[int, list[dict]] = {}


def _get_events_cached(round_id: int) -> list[dict]:
    if round_id not in _event_cache:
        _event_cache[round_id] = db.get_events(round_id)
    return _event_cache[round_id]


@app.get("/api/rounds", response_model=list[RoundSummary])
def list_rounds():
    return db.get_rounds()


@app.get("/api/round/{round_id}/definition", response_model=RoundDefinition)
def get_definition(round_id: int):
    defn = db.get_round_definition(round_id)
    if not defn:
        raise HTTPException(status_code=404, detail="Round not found")
    return defn


@app.get("/api/round/{round_id}/events")
def get_events(round_id: int):
    return _get_events_cached(round_id)


@app.get("/api/round/{round_id}/state", response_model=GameState)
def get_state(round_id: int, time_ms: int = 0):
    defn = db.get_round_definition(round_id)
    if not defn:
        raise HTTPException(status_code=404, detail="Round not found")

    round_start_time = defn.get("round_start_time")
    if round_start_time is None:
        raise HTTPException(status_code=400, detail="No round start time available for this round")

    round_start_ms = int(round_start_time * 1000)
    events = _get_events_cached(round_id)
    return compute_state(events, round_start_ms, time_ms)


@app.get("/api/round/{round_id}/truck/{card_id}/history")
def get_truck_history(round_id: int, card_id: str, time_ms: int = 0):
    defn = db.get_round_definition(round_id)
    if not defn:
        raise HTTPException(status_code=404, detail="Round not found")
    round_start_time = defn.get("round_start_time")
    if round_start_time is None:
        return []
    round_start_ms = int(round_start_time * 1000)
    mat_id = card_id.split("-")[0]
    entries = []
    for ev in _get_events_cached(round_id):
        ev_game_time = ev["_ts"] - round_start_ms
        if ev_game_time > time_ms:
            break
        inner = ev.get("event", {})
        if inner.get("type") != "card" or inner.get("cardId") != card_id:
            continue
        normalised = {str(k): v for k, v in inner.get("cardStorage", {}).items()}
        entries.append({
            "time_ms": ev_game_time,
            "node": ev.get("router", "?"),
            "cargo": normalised.get(mat_id, 0),
        })
    return entries


@app.get("/api/round/{round_id}/node/{node}/material/{mat_id}/history")
def get_storage_history(round_id: int, node: str, mat_id: str, time_ms: int = 0):
    defn = db.get_round_definition(round_id)
    if not defn:
        raise HTTPException(status_code=404, detail="Round not found")
    round_start_time = defn.get("round_start_time")
    if round_start_time is None:
        return []
    round_start_ms = int(round_start_time * 1000)
    entries = []
    for ev in _get_events_cached(round_id):
        ev_game_time = ev["_ts"] - round_start_ms
        if ev_game_time > time_ms:
            break
        inner = ev.get("event", {})
        if inner.get("type") != "card" or ev.get("router") != node:
            continue
        router_delta = {str(k): v for k, v in inner.get("routerDelta", {}).items()}
        delta = router_delta.get(mat_id, 0)
        if delta <= 0:
            continue
        entries.append({
            "time_ms": ev_game_time,
            "delta": delta,
            "card_id": inner.get("cardId", "?"),
        })
    return entries


@app.get("/api/layout/{round_id}", response_model=LayoutData)
def get_layout(round_id: int):
    layout_file = LAYOUT_DIR / f"{round_id}.json"
    if not layout_file.exists():
        raise HTTPException(status_code=404, detail="No saved layout")
    return json.loads(layout_file.read_text())


@app.post("/api/layout/{round_id}")
def save_layout(round_id: int, layout: LayoutData):
    layout_file = LAYOUT_DIR / f"{round_id}.json"
    existing = json.loads(layout_file.read_text()) if layout_file.exists() else {}
    # Only merge keys that were explicitly sent (exclude_unset), so saving positions
    # doesn't erase the custom name and saving a name doesn't erase positions.
    incoming = layout.model_dump(exclude_unset=True)
    layout_file.write_text(json.dumps({**existing, **incoming}))
    return {"ok": True}


# Serve built frontend in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
