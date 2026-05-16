export interface RoundSummary {
  round_id: number;
  round_name: string;
  event_count: number;
  duration_s: number;
}

export interface RouterDef {
  label: string;
  processes: string[];
}

export interface ProcessDef {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  duration: number;
}

export interface RoundDefinition {
  round_id: number;
  round_name: string;
  duration: number;
  routers: Record<string, RouterDef>;
  links: string[];
  processes: Record<string, ProcessDef>;
  materials: Record<string, { capacity: number }>;
  round_start_time: number | null;
  tick_duration_ms: number;
}

export interface TruckHistoryEntry {
  time_ms: number;
  node: string;
  cargo: number;
}

export interface StorageHistoryEntry {
  time_ms: number;
  delta: number;
  card_id: string;
}

export interface StationState {
  stock: Record<string, number>;
  produced?: Record<string, number>;
}

export interface TruckState {
  location: string;
  load: Record<string, number>;
}

export interface GameState {
  stations: Record<string, StationState>;
  trucks: Record<string, TruckState>;
  time_ms: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface EdgeOffset {
  ox: number;
  oy: number;
}

export interface LayoutData {
  positions: Record<string, NodePosition>;
  edge_offsets?: Record<string, EdgeOffset>;
  custom_name?: string;
}

export interface MaterialTraffic {
  goods: number;
  trips: number;
}

export interface EdgeTraffic {
  goods: number;
  trips: number;
  by_material: Record<string, MaterialTraffic>;
}

export interface TrafficResponse {
  edges: Record<string, EdgeTraffic>;
}

export interface NodeDistribution {
  delivered: number;
  taxed: number;
}

export interface DistributionResponse {
  nodes: Record<string, NodeDistribution>;
}

export interface TopologySummary {
  id: number;
  name: string;
  station_count: number;
  link_count: number;
}

export interface TopologyData {
  roundId: number;
  roundName: string;
  duration: number;
  processes: Record<string, ProcessDef>;
  materials: Record<string, { capacity: number }>;
  routers: Record<string, RouterDef>;
  links: string[];
  events: unknown[];
  editor_positions?: Record<string, NodePosition>;
}
