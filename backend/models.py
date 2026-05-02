from pydantic import BaseModel
from typing import Any


class RoundSummary(BaseModel):
    round_id: int
    round_name: str
    event_count: int
    duration_s: int


class RoundDefinition(BaseModel):
    round_id: int
    round_name: str
    duration: int
    routers: dict[str, Any]
    links: list[str]
    processes: dict[str, Any]
    materials: dict[str, Any]
    round_start_time: float | None
    tick_duration_ms: int


class StationState(BaseModel):
    stock: dict[str, int]


class TruckState(BaseModel):
    location: str
    load: dict[str, int]


class GameState(BaseModel):
    stations: dict[str, StationState]
    trucks: dict[str, TruckState]
    time_ms: int


class NodePosition(BaseModel):
    x: float
    y: float


class EdgeOffset(BaseModel):
    ox: float
    oy: float


class LayoutData(BaseModel):
    positions: dict[str, NodePosition]
    edge_offsets: dict[str, EdgeOffset] = {}
