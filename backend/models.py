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
    produced: dict[str, int] = {}


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
    positions: dict[str, NodePosition] = {}
    edge_offsets: dict[str, EdgeOffset] = {}
    custom_name: str | None = None
    process_set_key: str | None = None


class MaterialTraffic(BaseModel):
    goods: int
    trips: int


class EdgeTraffic(BaseModel):
    goods: int
    trips: int
    by_material: dict[str, MaterialTraffic] = {}


class TrafficResponse(BaseModel):
    edges: dict[str, EdgeTraffic]


class NodeDistribution(BaseModel):
    delivered: int
    taxed: int


class DistributionResponse(BaseModel):
    nodes: dict[str, NodeDistribution]


class TopologyData(BaseModel):
    roundId: int
    roundName: str
    duration: int
    processes: dict[str, Any]
    materials: dict[str, Any]
    routers: dict[str, Any]
    links: list[str]
    events: list = []
    editor_positions: dict[str, Any] = {}


class TopologySummary(BaseModel):
    id: int
    name: str
    station_count: int
    link_count: int
