import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { GameState, RoundDefinition } from '../types/game';
import { NetworkMap } from '../components/NetworkMap';
import { ReplayControls } from '../components/ReplayControls';

const LAYERS = [
  { id: 'storage', label: 'Storage' },
  { id: 'taxed',   label: 'Taxed'   },
  { id: 'traffic', label: 'Traffic' },
] as const;

type LayerId = (typeof LAYERS)[number]['id'];

export function Visualizer() {
  const { roundId: roundIdParam } = useParams<{ roundId: string }>();
  const roundId = Number(roundIdParam);

  const [definition, setDefinition] = useState<RoundDefinition | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['storage']));

  useEffect(() => {
    if (!roundId) return;
    setDefinition(null);
    setGameState(null);
    setTimeMs(0);
    api.getDefinition(roundId).then(setDefinition).catch((e) => setError(String(e)));
  }, [roundId]);

  const handleTimeChange = useCallback((next: number) => {
    setTimeMs(next);
    if (roundId && definition) {
      api.getState(roundId, next).then(setGameState).catch(console.error);
    }
  }, [roundId, definition]);

  const toggleLayer = (id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (error) {
    return (
      <div style={{ padding: 32, color: '#d45500', fontFamily: 'monospace' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#151d28',
        borderRight: '1px solid #2a3a4a',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0',
        overflowY: 'auto',
      }}>

        <section style={{ padding: '0 16px 20px' }}>
          <div style={sectionLabel}>Round</div>
          {definition && (
            <div style={{ fontSize: 11, color: '#566878', lineHeight: 1.6 }}>
              <span style={{ color: '#8a9aaa', fontFamily: 'monospace' }}>{definition.round_name}</span><br />
              {Object.keys(definition.routers).length} stations · {definition.links.length} links
              {definition.duration > 0 && <><br />{definition.duration / 60} min</>}
            </div>
          )}
        </section>

        <div style={divider} />

        <section style={{ padding: '16px 16px 0' }}>
          <div style={sectionLabel}>Layers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {LAYERS.map(({ id, label }) => {
              const checked = activeLayers.has(id);
              return (
                <label key={id} style={layerRow(checked)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLayer(id)}
                    style={{ display: 'none' }}
                  />
                  <span style={checkbox(checked)} />
                  <span style={{ fontSize: 13, userSelect: 'none' }}>{label}</span>
                </label>
              );
            })}
          </div>
        </section>

      </aside>

      {/* ── Main canvas + controls ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {definition ? (
          <>
            <NetworkMap
              roundId={roundId}
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a5060', fontSize: 18 }}>
            Loading…
          </div>
        )}
      </div>

    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#4a6070', marginBottom: 10,
};

const divider: React.CSSProperties = {
  height: 1, background: '#2a3a4a', margin: '0 16px',
};

const layerRow = (checked: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
  background: checked ? 'rgba(55,171,200,0.08)' : 'transparent',
  color: checked ? '#c8dce8' : '#6a8090',
  transition: 'background 0.1s, color 0.1s',
});

const checkbox = (checked: boolean): React.CSSProperties => ({
  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
  border: `1.5px solid ${checked ? '#37abc8' : '#3a4a5a'}`,
  background: checked ? '#37abc8' : 'transparent',
  boxShadow: checked ? 'inset 0 0 0 2px #151d28' : 'none',
  transition: 'background 0.1s, border-color 0.1s',
});
