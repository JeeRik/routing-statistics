import json
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).parent))

import db
from models import DistributionResponse, EdgeTraffic, GameState, LayoutData, MaterialTraffic, NodeDistribution, RoundDefinition, RoundSummary, TrafficResponse
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
        if delta == 0:
            continue
        entries.append({
            "time_ms": ev_game_time,
            "delta": delta,
            "card_id": inner.get("cardId", "?"),
        })
    return entries


@app.get("/api/round/{round_id}/traffic", response_model=TrafficResponse)
def get_traffic(round_id: int, time_ms: int = 0, from_ms: int = 0):
    defn = db.get_round_definition(round_id)
    if not defn:
        raise HTTPException(status_code=404, detail="Round not found")
    round_start_time = defn.get("round_start_time")
    if round_start_time is None:
        return TrafficResponse(edges={})

    round_start_ms = int(round_start_time * 1000)
    known_stations = set(defn.get("routers", {}).keys())
    cutoff   = round_start_ms + time_ms
    window_start = round_start_ms + from_ms  # trips arriving before this are excluded

    # Group card events at known stations by cardId, storing arrival timestamp
    trucks: dict[str, list[dict]] = {}
    for ev in _get_events_cached(round_id):
        if ev["_ts"] > cutoff:
            break
        inner = ev.get("event", {})
        if inner.get("type") != "card":
            continue
        router = ev.get("router", "")
        if router not in known_stations:
            continue
        card_id = inner.get("cardId", "")
        if card_id not in trucks:
            trucks[card_id] = []
        trucks[card_id].append({"router": router, "cardStorage": inner.get("cardStorage", {}), "ts": ev["_ts"]})

    # Walk consecutive station pairs to infer edge traversals
    edge_goods: dict[str, int] = {}
    edge_trips: dict[str, int] = {}
    edge_mat_goods: dict[str, dict[str, int]] = {}
    edge_mat_trips: dict[str, dict[str, int]] = {}
    for events in trucks.values():
        for i in range(1, len(events)):
            prev, curr = events[i - 1], events[i]
            if prev["router"] == curr["router"]:
                continue
            if curr["ts"] < window_start:  # trip completed before the window — skip
                continue
            key = prev["router"] + curr["router"]
            goods = sum(prev["cardStorage"].values())
            edge_goods[key] = edge_goods.get(key, 0) + goods
            edge_trips[key] = edge_trips.get(key, 0) + 1
            mat_goods = edge_mat_goods.setdefault(key, {})
            mat_trips = edge_mat_trips.setdefault(key, {})
            for mat_id, qty in prev["cardStorage"].items():
                m = str(mat_id)
                if qty > 0:
                    mat_goods[m] = mat_goods.get(m, 0) + qty
                    mat_trips[m] = mat_trips.get(m, 0) + 1

    edges = {
        key: EdgeTraffic(
            goods=edge_goods[key],
            trips=edge_trips[key],
            by_material={
                m: MaterialTraffic(goods=g, trips=edge_mat_trips[key].get(m, 0))
                for m, g in edge_mat_goods.get(key, {}).items()
            },
        )
        for key in edge_goods
    }
    return TrafficResponse(edges=edges)


@app.get("/api/round/{round_id}/distribution", response_model=DistributionResponse)
def get_distribution(round_id: int, time_ms: int = 0, material_id: str = ""):
    defn = db.get_round_definition(round_id)
    if not defn:
        raise HTTPException(status_code=404, detail="Round not found")
    round_start_time = defn.get("round_start_time")
    if round_start_time is None or not material_id:
        return DistributionResponse(nodes={})

    round_start_ms = int(round_start_time * 1000)
    cutoff = round_start_ms + time_ms
    known_stations = set(defn.get("routers", {}).keys())

    delivered: dict[str, int] = {}
    taxed: dict[str, int] = {}

    # material IDs in event JSON may be int or str — try both
    mat_int = int(material_id) if material_id.isdigit() else None

    def _get(d: dict, key: str) -> int:
        v = d.get(key, d.get(mat_int, 0) if mat_int is not None else 0)
        return int(v) if v else 0

    for ev in _get_events_cached(round_id):
        if ev["_ts"] > cutoff:
            break
        inner = ev.get("event", {})
        if inner.get("type") != "card":
            continue
        router = ev.get("router", "")
        if router not in known_stations:
            continue
        delta = _get(inner.get("routerDelta", {}), material_id)
        toll  = _get(inner.get("linkDelta",   {}), material_id)
        # rDelta < 0 → truck delivered to router (router gained material)
        if delta < 0:
            delivered[router] = delivered.get(router, 0) + abs(delta)
        # lDelta > 0 → customs toll was deducted at this scan
        if toll > 0:
            taxed[router] = taxed.get(router, 0) + toll

    return DistributionResponse(nodes={
        r: NodeDistribution(delivered=delivered.get(r, 0), taxed=taxed.get(r, 0))
        for r in known_stations
    })


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
