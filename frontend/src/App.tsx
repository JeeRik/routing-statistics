import { useEffect, useState, useCallback } from 'react';
import { api } from './api/client';
import type { GameState, RoundDefinition, RoundSummary } from './types/game';
import { NetworkMap } from './components/NetworkMap';
import { ReplayControls } from './components/ReplayControls';

export default function App() {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [definition, setDefinition] = useState<RoundDefinition | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRounds()
      .then((r) => {
        setRounds(r);
        const real = r.find((x) => x.round_id === 21) ?? r[0];
        if (real) setSelectedRoundId(real.round_id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (selectedRoundId == null) return;
    setDefinition(null);
    setGameState(null);
    setTimeMs(0);
    api.getDefinition(selectedRoundId)
      .then(setDefinition)
      .catch((e) => setError(String(e)));
  }, [selectedRoundId]);

  const handleTimeChange = useCallback((next: number) => {
    setTimeMs(next);
    if (selectedRoundId != null && definition != null) {
      api.getState(selectedRoundId, next)
        .then(setGameState)
        .catch(console.error);
    }
  }, [selectedRoundId, definition]);

  if (error) {
    return (
      <div style={{ padding: 32, color: '#d45500', fontFamily: 'monospace' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111820', color: '#e0eaf0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', background: '#1e2530', borderBottom: '1px solid #2a3a4a', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>routing-statistics</span>
        <select
          value={selectedRoundId ?? ''}
          onChange={(e) => setSelectedRoundId(Number(e.target.value))}
          style={{ background: '#111820', color: '#e0eaf0', border: '1px solid #3a4a5a', borderRadius: 4, padding: '4px 10px', fontSize: 14 }}
        >
          {rounds.map((r) => (
            <option key={r.round_id} value={r.round_id}>
              Round {r.round_id} — {r.round_name} ({r.event_count} events)
            </option>
          ))}
        </select>
        {definition && (
          <span style={{ color: '#8a9aaa', fontSize: 13 }}>
            {Object.keys(definition.routers).length} stations · {definition.links.length} directed links
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {definition ? (
          <>
            <NetworkMap
              roundId={selectedRoundId!}
              definition={definition}
              gameState={gameState}
            />
            {definition.duration > 0 && (
              <ReplayControls
                durationMs={definition.duration * 1000}
                timeMs={timeMs}
                onTimeChange={handleTimeChange}
              />
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6070', fontSize: 18 }}>
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
