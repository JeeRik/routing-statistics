import type { GameState, LayoutData, RoundDefinition, RoundSummary } from '../types/game';

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
  getLayout: (roundId: number) => get<LayoutData>(`/api/layout/${roundId}`),
  saveLayout: (roundId: number, layout: LayoutData) =>
    post<{ ok: boolean }>(`/api/layout/${roundId}`, layout),
};
