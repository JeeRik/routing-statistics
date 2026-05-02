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


@app.get("/api/layout/{round_id}", response_model=LayoutData)
def get_layout(round_id: int):
    layout_file = LAYOUT_DIR / f"{round_id}.json"
    if not layout_file.exists():
        raise HTTPException(status_code=404, detail="No saved layout")
    return json.loads(layout_file.read_text())


@app.post("/api/layout/{round_id}")
def save_layout(round_id: int, layout: LayoutData):
    layout_file = LAYOUT_DIR / f"{round_id}.json"
    layout_file.write_text(layout.model_dump_json())
    return {"ok": True}


# Serve built frontend in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
