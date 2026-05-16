import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { setCookie } from '../utils/cookies';
import { api } from '../api/client';
import type { DistributionResponse, GameState, RoundDefinition, TrafficResponse } from '../types/game';
import { MATERIAL_IDS } from '../constants';
import { NetworkMap } from '../components/NetworkMap';
import { MaterialPicker } from '../components/MaterialPicker';
import type { MaterialLink } from '../components/MaterialPicker';
import { ReplayControls } from '../components/ReplayControls';

const LAYERS = [
  { id: 'storage',      label: 'Storage'        },
  { id: 'cargo',        label: 'Truck locations' },
  { id: 'distribution', label: 'Distribution'    },
  { id: 'traffic',      label: 'Traffic'         },
] as const;


type LayerId = (typeof LAYERS)[number]['id'];
type TrafficMode = 'whole-game' | 'last-20s' | 'last-60s';

export function Visualizer() {
  const { roundId: roundIdParam } = useParams<{ roundId: string }>();
  const roundId = Number(roundIdParam);

  const [definition, setDefinition] = useState<RoundDefinition | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['storage']));
  const [trafficMode, setTrafficMode] = useState<TrafficMode>('whole-game');
  const [trafficData, setTrafficData] = useState<TrafficResponse | null>(null);
  const [distMaterial, setDistMaterial] = useState<string>('2');
  const [distributionData, setDistributionData] = useState<DistributionResponse | null>(null);
  const [distTrafficData, setDistTrafficData] = useState<TrafficResponse | null>(null);

  const materialLinks = useMemo((): MaterialLink[] => {
    if (!definition) return [];
    const toId = (name: string) => MATERIAL_IDS[name] ?? name;
    const links: MaterialLink[] = [];
    for (const proc of Object.values(definition.processes)) {
      const outputs = Object.keys(proc.outputs).map(toId);
      const inputs  = Object.keys(proc.inputs).map(toId);
      for (const out of outputs)
        for (const inp of inputs)
          links.push({ input: inp, output: out });
    }
    return links;
  }, [definition]);

  useEffect(() => {
    if (!roundId) return;
    setCookie('last_round_id', String(roundId));
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

  // Fetch distribution node + edge data when the layer is active, debounced 200 ms
  useEffect(() => {
    if (!activeLayers.has('distribution') || !definition || !distMaterial) {
      setDistributionData(null);
      setDistTrafficData(null);
      return;
    }
    const t = setTimeout(() => {
      api.getDistribution(roundId, timeMs, distMaterial).then(setDistributionData).catch(console.error);
      api.getTraffic(roundId, timeMs, 0).then(setDistTrafficData).catch(console.error);
    }, 200);
    return () => clearTimeout(t);
  }, [activeLayers, timeMs, distMaterial, roundId, definition]);

  // Fetch traffic data when the layer is active, debounced 200 ms
  useEffect(() => {
    if (!activeLayers.has('traffic') || !definition) {
      setTrafficData(null);
      return;
    }
    const fromMs = trafficMode === 'last-20s' ? Math.max(0, timeMs - 20_000)
                 : trafficMode === 'last-60s' ? Math.max(0, timeMs - 60_000)
                 : 0;
    const t = setTimeout(() => {
      api.getTraffic(roundId, timeMs, fromMs).then(setTrafficData).catch(console.error);
    }, 200);
    return () => clearTimeout(t);
  }, [activeLayers, timeMs, trafficMode, roundId, definition]);

  if (error) {
    return (
      <div style={{ padding: 32, color: '#d45500', fontFamily: 'monospace' }}>
        Error: {error}
      </div>
    );
  }

  const trafficActive = activeLayers.has('traffic');

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
                <div key={id}>
                  <label style={layerRow(checked)}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLayer(id)}
                      style={{ display: 'none' }}
                    />
                    <span style={checkbox(checked)} />
                    <span style={{ fontSize: 13, userSelect: 'none' }}>{label}</span>
                  </label>

                  {/* Distribution material color picker + None button */}
                  {id === 'distribution' && checked && (
                    <div style={{ paddingLeft: 10, marginTop: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MaterialPicker value={distMaterial} onChange={setDistMaterial} links={materialLinks} />
                      <button
                        title="None"
                        onClick={() => setDistMaterial('')}
                        style={{
                          background: distMaterial === '' ? 'rgba(255,255,255,0.08)' : 'transparent',
                          border: `2px solid ${distMaterial === '' ? '#fff' : 'transparent'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          padding: 6,
                          color: '#d40000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          alignSelf: 'center',
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: 20, lineHeight: 1 }}>block</span>
                      </button>
                    </div>
                  )}

                  {/* Traffic mode radio buttons */}
                  {id === 'traffic' && trafficActive && (
                    <div style={{ paddingLeft: 34, marginTop: 2, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {([
                        { value: 'whole-game', label: 'Whole game' },
                        { value: 'last-60s',   label: 'Last 60 s'  },
                        { value: 'last-20s',   label: 'Last 20 s'  },
                      ] as const).map((opt) => (
                        <label
                          key={opt.value}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            fontSize: 11, fontFamily: 'monospace',
                            color: '#8a9aaa',
                            cursor: 'pointer',
                            padding: '3px 0',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="radio"
                            name="traffic-mode"
                            value={opt.value}
                            checked={trafficMode === opt.value}
                            onChange={() => setTrafficMode(opt.value)}
                            style={{ accentColor: '#ffcc44', cursor: 'pointer' }}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
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
              activeLayers={activeLayers}
              timeMs={timeMs}
              trafficData={trafficData}
              distributionData={distributionData}
              distMaterial={distMaterial}
              distTrafficData={distTrafficData}
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
