import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api/client';
import type { GameState, RoundDefinition, RoundSummary } from './types/game';
import { NetworkMap } from './components/NetworkMap';
import { ReplayControls } from './components/ReplayControls';

const LAYERS = [
  { id: 'storage', label: 'Storage' },
  { id: 'taxed',   label: 'Taxed'   },
  { id: 'traffic', label: 'Traffic' },
] as const;

type LayerId = (typeof LAYERS)[number]['id'];

// ── Inline-editable round name ─────────────────────────────────────────────

interface EditableNameProps {
  name: string;
  roundId: number;
  onChange: (name: string) => void;
}

function EditableName({ name, roundId, onChange }: EditableNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(name); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    onChange(draft.trim());
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  commit();
          if (e.key === 'Escape') { setEditing(false); setDraft(name); }
        }}
        style={{
          width: '100%', background: '#111820', color: '#e0eaf0',
          border: '1px solid #37abc8', borderRadius: 5,
          padding: '5px 8px', fontSize: 14, outline: 'none',
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to rename"
      style={{ cursor: 'text', display: 'flex', alignItems: 'baseline', gap: 6, minHeight: 28 }}
    >
      <span style={{ fontSize: 14, color: name ? '#c8dce8' : '#3a5060', fontWeight: name ? 600 : 400 }}>
        {name || 'Add a name…'}
      </span>
      <span style={{ fontSize: 11, color: '#3a5060', flexShrink: 0 }}>
        ({roundId})
      </span>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [definition, setDefinition] = useState<RoundDefinition | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['storage']));
  // custom names keyed by round_id, loaded lazily as rounds are visited
  const [customNames, setCustomNames] = useState<Record<number, string>>({});

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
    api.getDefinition(selectedRoundId).then(setDefinition).catch((e) => setError(String(e)));
    // Load custom name for this round from its layout file
    api.getLayout(selectedRoundId)
      .then((layout) => {
        setCustomNames((prev) => ({ ...prev, [selectedRoundId]: layout.custom_name ?? '' }));
      })
      .catch(() => {
        setCustomNames((prev) => ({ ...prev, [selectedRoundId]: '' }));
      });
  }, [selectedRoundId]);

  const handleTimeChange = useCallback((next: number) => {
    setTimeMs(next);
    if (selectedRoundId != null && definition != null) {
      api.getState(selectedRoundId, next).then(setGameState).catch(console.error);
    }
  }, [selectedRoundId, definition]);

  const handleNameChange = useCallback((name: string) => {
    if (selectedRoundId == null) return;
    setCustomNames((prev) => ({ ...prev, [selectedRoundId]: name }));
    api.saveLayout(selectedRoundId, { custom_name: name || undefined }).catch(console.error);
  }, [selectedRoundId]);

  const toggleLayer = (id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const roundLabel = (r: RoundSummary) => {
    const custom = customNames[r.round_id];
    return custom ? `${custom} (${r.round_id})` : `${r.round_name} (${r.round_id})`;
  };

  if (error) {
    return (
      <div style={{ padding: 32, color: '#d45500', fontFamily: 'monospace' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111820', color: '#e0eaf0' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 42,
        background: '#1a2230', borderBottom: '1px solid #2a3a4a',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1, color: '#c8dce8' }}>
          routing-statistics
        </span>
      </div>

      {/* ── Body ── */}
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

          {/* Round section */}
          <section style={{ padding: '0 16px 20px' }}>
            <div style={sectionLabel}>Round</div>
            <select
              value={selectedRoundId ?? ''}
              onChange={(e) => setSelectedRoundId(Number(e.target.value))}
              style={{
                width: '100%',
                background: '#111820', color: '#e0eaf0',
                border: '1px solid #2a3a4a', borderRadius: 5,
                padding: '6px 8px', fontSize: 13,
                cursor: 'pointer', marginBottom: 10,
              }}
            >
              {rounds.map((r) => (
                <option key={r.round_id} value={r.round_id}>
                  {roundLabel(r)}
                </option>
              ))}
            </select>

            {selectedRoundId != null && (
              <EditableName
                name={customNames[selectedRoundId] ?? ''}
                roundId={selectedRoundId}
                onChange={handleNameChange}
              />
            )}

            {definition && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#566878', lineHeight: 1.6 }}>
                {Object.keys(definition.routers).length} stations<br />
                {definition.links.length} links<br />
                {definition.duration > 0 && `${definition.duration / 60} min`}
              </div>
            )}
          </section>

          <div style={divider} />

          {/* Layers section */}
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a5060', fontSize: 18 }}>
              Loading…
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────

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
