import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "game-logs-2026-03-26.sqlite3"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_rounds() -> list[dict]:
    with _connect() as conn:
        game_row = conn.execute(
            "SELECT round_def, round_start_time, tick_duration_ms FROM game LIMIT 1"
        ).fetchone()

        round_def = json.loads(game_row["round_def"]) if game_row else {}
        round_start_time = game_row["round_start_time"] if game_row else None
        tick_duration_ms = game_row["tick_duration_ms"] if game_row else 1000

        counts = conn.execute(
            "SELECT round_id, COUNT(*) as cnt FROM box_events GROUP BY round_id ORDER BY round_id"
        ).fetchall()

        results = []
        for row in counts:
            rid = row["round_id"]
            if rid == round_def.get("roundId"):
                name = round_def.get("roundName", str(rid))
                duration = round_def.get("duration", 0)
            else:
                name = str(rid)
                duration = 0
            results.append({
                "round_id": rid,
                "round_name": name,
                "event_count": row["cnt"],
                "duration_s": duration,
                "round_start_time": round_start_time if rid == round_def.get("roundId") else None,
                "tick_duration_ms": tick_duration_ms,
            })
        return results


def get_round_definition(round_id: int) -> dict | None:
    with _connect() as conn:
        game_row = conn.execute(
            "SELECT round_def, round_start_time, tick_duration_ms FROM game LIMIT 1"
        ).fetchone()
        if not game_row:
            return None

        round_def = json.loads(game_row["round_def"])
        if round_def.get("roundId") != round_id:
            # For dev/test rounds (42, 123) we have no round_def in game table;
            # return a minimal stub so the frontend can still render something.
            routers_raw = conn.execute(
                "SELECT DISTINCT json_extract(data, '$.router') as r FROM box_events WHERE round_id=?",
                (round_id,),
            ).fetchall()
            routers = {row["r"]: {"label": row["r"], "processes": []} for row in routers_raw if row["r"]}
            return {
                "round_id": round_id,
                "round_name": str(round_id),
                "duration": 0,
                "routers": routers,
                "links": [],
                "processes": {},
                "materials": {},
                "round_start_time": None,
                "tick_duration_ms": game_row["tick_duration_ms"],
            }

        return {
            "round_id": round_id,
            "round_name": round_def.get("roundName", str(round_id)),
            "duration": round_def.get("duration", 0),
            "routers": round_def.get("routers", {}),
            "links": round_def.get("links", []),
            "processes": round_def.get("processes", {}),
            "materials": round_def.get("materials", {}),
            "round_start_time": game_row["round_start_time"],
            "tick_duration_ms": game_row["tick_duration_ms"],
        }


def get_events(round_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT next_attention, data FROM box_events WHERE round_id=? ORDER BY next_attention",
            (round_id,),
        ).fetchall()
        events = []
        for row in rows:
            payload = json.loads(row["data"])
            payload["_ts"] = row["next_attention"]
            events.append(payload)
        return events
