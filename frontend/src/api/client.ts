import type { DistributionResponse, GameState, LayoutData, RoundDefinition, RoundSummary, StorageHistoryEntry, TopologyData, TopologySummary, TrafficResponse, TruckHistoryEntry } from '../types/game';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json();
}

export const api = {
  getRounds: () => get<RoundSummary[]>('/api/rounds'),
  getDefinition: (roundId: number) => get<RoundDefinition>(`/api/round/${roundId}/definition`),
  getState: (roundId: number, timeMs: number) =>
    get<GameState>(`/api/round/${roundId}/state?time_ms=${timeMs}`),
  getTruckHistory: (roundId: number, cardId: string, timeMs: number) =>
    get<TruckHistoryEntry[]>(`/api/round/${roundId}/truck/${cardId}/history?time_ms=${timeMs}`),
  getStorageHistory: (roundId: number, node: string, matId: string, timeMs: number) =>
    get<StorageHistoryEntry[]>(`/api/round/${roundId}/node/${node}/material/${matId}/history?time_ms=${timeMs}`),
  getTraffic: (roundId: number, timeMs: number, fromMs = 0) =>
    get<TrafficResponse>(`/api/round/${roundId}/traffic?time_ms=${timeMs}&from_ms=${fromMs}`),
  getDistribution: (roundId: number, timeMs: number, materialId: string) =>
    get<DistributionResponse>(`/api/round/${roundId}/distribution?time_ms=${timeMs}&material_id=${materialId}`),
  getLayout: (roundId: number) => get<LayoutData>(`/api/layout/${roundId}`),
  saveLayout: (roundId: number, layout: Partial<LayoutData>) =>
    post<{ ok: boolean }>(`/api/layout/${roundId}`, layout),
  getTopologies: () => get<TopologySummary[]>('/api/topologies'),
  getTopology: (id: number) => get<TopologyData>(`/api/topology/${id}`),
  saveTopology: (id: number, topo: TopologyData) =>
    post<{ ok: boolean }>(`/api/topology/${id}`, topo),
  createTopology: (topo: TopologyData) =>
    post<TopologySummary>('/api/topologies/new', topo),
  deleteTopology: async (id: number): Promise<void> => {
    const res = await fetch(`/api/topology/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — DELETE /api/topology/${id}`);
  },
};
