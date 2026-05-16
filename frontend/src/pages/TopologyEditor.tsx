import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setCookie } from '../utils/cookies';
import { api } from '../api/client';
import type { NodePosition, RouterDef, TopologyData } from '../types/game';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { PROCESS_SETS, detectProcessSet, processOutputColor } from '../data/processSets';
import type { ProcessSet } from '../data/processSets';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ROCKET_PROCESS = {
  inputs: { brown: 2, red: 6, purple: 8 },
  outputs: {} as Record<string, number>,
  duration: 2,
};

function nextUnusedLetter(routers: Record<string, RouterDef>): string {
  return LETTERS.find((l) => !(l in routers)) ?? 'A';
}

function circleLayout(letters: string[]): Record<string, NodePosition> {
  const n = letters.length;
  const radius = Math.max(200, n * 40);
  const result: Record<string, NodePosition> = {};
  letters.forEach((l, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    result[l] = { x: radius * Math.cos(angle) + radius, y: radius * Math.sin(angle) + radius };
  });
  return result;
}

function emptyTopology(processSet: ProcessSet): TopologyData {
  return {
    roundId: 0,
    roundName: 'New topology',
    duration: 720,
    processes: processSet.processes,
    materials: processSet.materials,
    routers: {},
    links: [],
    events: [],
    editor_positions: {},
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#111820',
  color: '#e0eaf0',
  border: '1px solid #2a3a4a',
  borderRadius: 5,
  padding: '5px 8px',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#4a6070',
  marginBottom: 4,
  display: 'block',
};

const sectionStyle: React.CSSProperties = { marginBottom: 16 };

export function TopologyEditor() {
  const { topoId } = useParams<{ topoId: string }>();
  const navigate = useNavigate();
  const isNew = topoId === 'new' || !topoId;

  const defaultSet = PROCESS_SETS[2]; // full chain
  const [processSetKey, setProcessSetKey] = useState(defaultSet.key);
  const processSet = PROCESS_SETS.find((s) => s.key === processSetKey) ?? defaultSet;

  const [topo, setTopo] = useState<TopologyData>(() => emptyTopology(defaultSet));
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [edgeOffsets, setEdgeOffsets] = useState<Record<string, { ox: number; oy: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  const isFirstRenderRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNew) { setLoaded(true); return; }
    const id = parseInt(topoId!, 10);
    setCookie('last_topo_id', topoId!);
    api.getTopology(id).then((data) => {
      setTopo(data);
      const savedPos = (data.editor_positions ?? {}) as Record<string, NodePosition>;
      setPositions(
        Object.keys(savedPos).length > 0
          ? savedPos
          : circleLayout(Object.keys(data.routers)),
      );
      setProcessSetKey(detectProcessSet(data.processes));
      setLoaded(true);
    }).catch((e) => setError(String(e)));
  }, [topoId, isNew]);

  const handleAddNode = useCallback((letter: string, position: { x: number; y: number }) => {
    setTopo((prev) => ({
      ...prev,
      routers: { ...prev.routers, [letter]: { label: letter, processes: [] } },
    }));
    setPositions((prev) => ({ ...prev, [letter]: position }));
    setSelectedNodeId(letter);
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    setTopo((prev) => {
      const routers = { ...prev.routers };
      delete routers[id];
      return { ...prev, routers, links: prev.links.filter((l) => l[0] !== id && l[1] !== id) };
    });
    setPositions((prev) => { const p = { ...prev }; delete p[id]; return p; });
    setSelectedNodeId((s) => (s === id ? null : s));
  }, []);

  const handleAddLink = useCallback((source: string, target: string) => {
    setTopo((prev) => {
      const existing = new Set(prev.links);
      const fwd = source + target, bwd = target + source;
      const newLinks = [...prev.links];
      if (!existing.has(fwd)) newLinks.push(fwd);
      if (!existing.has(bwd)) newLinks.push(bwd);
      return { ...prev, links: newLinks };
    });
  }, []);

  const handleDeleteLink = useCallback((edgeId: string) => {
    const [a, b] = edgeId.split('-');
    setTopo((prev) => ({
      ...prev,
      links: prev.links.filter((l) => !(l === a + b || l === b + a)),
    }));
  }, []);

  const handlePositionChange = useCallback((pos: Record<string, NodePosition>) => {
    setPositions(pos);
  }, []);

  const handleProcessSetChange = (key: string) => {
    const newSet = PROCESS_SETS.find((s) => s.key === key)!;
    setProcessSetKey(key);
    setTopo((prev) => {
      const routers = Object.fromEntries(
        Object.entries(prev.routers).map(([l, r]) => [
          l,
          { ...r, processes: r.processes.filter((p) => p in newSet.processes || p === 'factory_rocket') },
        ]),
      );
      return { ...prev, processes: newSet.processes, materials: newSet.materials, routers };
    });
  };

  const handleNodeLabelChange = (letter: string, label: string) => {
    setTopo((prev) => ({
      ...prev,
      routers: { ...prev.routers, [letter]: { ...prev.routers[letter], label } },
    }));
  };

  const handleProcessChange = useCallback((nodeId: string, processName: string | null) => {
    setTopo((prev) => {
      let processes = prev.processes;
      // Auto-add factory_rocket to the processes dict if not already there
      if (processName === 'factory_rocket' && !('factory_rocket' in processes)) {
        processes = { ...processes, factory_rocket: ROCKET_PROCESS };
      }
      return {
        ...prev,
        processes,
        routers: {
          ...prev.routers,
          [nodeId]: { ...prev.routers[nodeId], processes: processName ? [processName] : [] },
        },
      };
    });
  }, []);

  // Auto-save: debounce 800 ms after last change; skip the initial load render
  useEffect(() => {
    if (!loaded) return;
    if (isFirstRenderRef.current) { isFirstRenderRef.current = false; return; }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('idle');
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const data: TopologyData = { ...topo, editor_positions: positions };
        if (isNew) {
          const summary = await api.createTopology(data);
          navigate(`/topology/${summary.id}/edit`, { replace: true });
        } else {
          await api.saveTopology(parseInt(topoId!, 10), data);
          setSaveStatus('saved');
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (e) {
        setError(String(e));
        setSaveStatus('error');
      }
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [topo, positions, loaded, isNew, topoId, navigate]);

  if (!loaded) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6070' }}>
        Loading…
      </div>
    );
  }

  const selectedRouter = selectedNodeId ? topo.routers[selectedNodeId] : null;
  const next = nextUnusedLetter(topo.routers);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 250,
        flexShrink: 0,
        background: '#151d28',
        borderRight: '1px solid #2a3a4a',
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 12px',
        overflowY: 'auto',
      }}>
        <button
          onClick={() => navigate('/topologies')}
          style={{
            background: 'transparent', border: 'none', color: '#4a6070',
            fontSize: 12, cursor: 'pointer', textAlign: 'left',
            padding: '0 0 12px 0', fontFamily: 'monospace',
          }}
        >
          ← Topologies
        </button>

        <div style={sectionStyle}>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            value={topo.roundName}
            onChange={(e) => setTopo((p) => ({ ...p, roundName: e.target.value }))}
          />
        </div>
        <div style={sectionStyle}>
          <label style={labelStyle}>Duration (s)</label>
          <input
            style={inputStyle}
            type="number"
            value={topo.duration}
            onChange={(e) => setTopo((p) => ({ ...p, duration: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div style={sectionStyle}>
          <label style={labelStyle}>Process set</label>
          <select
            value={processSetKey}
            onChange={(e) => handleProcessSetChange(e.target.value)}
            style={{ ...inputStyle, appearance: 'none' }}
          >
            {PROCESS_SETS.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div style={{
          marginBottom: 12, padding: '6px 8px', background: '#111820',
          borderRadius: 5, fontSize: 11, fontFamily: 'monospace', color: '#6a8090',
          display: 'flex', gap: 14,
        }}>
          <span>{Object.keys(topo.routers).length} stations</span>
          <span>{topo.links.length} links</span>
        </div>

        {/* Create node button */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Add station</label>
          <button
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-topo-node', '1');
              const ghost = document.createElement('div');
              Object.assign(ghost.style, {
                position: 'fixed', left: '-200px', top: '-200px',
                width: '105px', boxSizing: 'border-box',
                background: '#1e2530', border: '2px solid #3a4a5a',
                borderRadius: '8px', padding: '6px 10px',
                textAlign: 'center', fontFamily: 'monospace',
                color: '#e0eaf0', fontSize: '16px', fontWeight: '700',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
              });
              ghost.textContent = next;
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
              requestAnimationFrame(() => ghost.remove());
            }}
            onClick={() => handleAddNode(next, { x: 0, y: 0 })}
            title="Click to add at origin, or drag onto canvas"
            style={{
              width: '100%',
              background: 'rgba(55,171,200,0.1)',
              color: '#37abc8',
              border: '1px dashed rgba(55,171,200,0.5)',
              borderRadius: 5,
              padding: '7px 10px',
              fontSize: 12,
              cursor: 'grab',
              fontFamily: 'monospace',
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            New node: {next}
          </button>
        </div>

        <div style={{ borderTop: '1px solid #2a3a4a', marginBottom: 12 }} />

        {/* Selected node panel */}
        {selectedRouter && selectedNodeId ? (
          <>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: '#37abc8', marginBottom: 10,
            }}>
              Station {selectedNodeId}
            </div>
            <div style={sectionStyle}>
              <label style={labelStyle}>Label</label>
              <input
                style={inputStyle}
                value={selectedRouter.label}
                onChange={(e) => handleNodeLabelChange(selectedNodeId, e.target.value)}
              />
            </div>

            {/* Process — read-only display; change via Alt+click on canvas */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Process</label>
              {selectedRouter.processes[0] ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontFamily: 'monospace', color: '#c8dce8',
                  padding: '5px 8px',
                  background: '#111820', borderRadius: 5,
                  border: '1px solid #2a3a4a',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: processOutputColor(selectedRouter.processes[0]),
                  }} />
                  {selectedRouter.processes[0].replace('factory_', '')}
                </div>
              ) : (
                <div style={{
                  fontSize: 12, fontFamily: 'monospace', color: '#3a5060',
                  padding: '5px 8px',
                  background: '#111820', borderRadius: 5,
                  border: '1px solid #2a3a4a',
                }}>
                  none
                </div>
              )}
              <div style={{ fontSize: 10, color: '#3a5060', marginTop: 4, fontFamily: 'monospace' }}>
                Alt+click node to change
              </div>
            </div>

            <button
              onClick={() => handleDeleteNode(selectedNodeId)}
              style={{
                width: '100%',
                background: '#1a1010', color: '#d46060', border: '1px solid #3a1a1a',
                borderRadius: 5, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              Remove {selectedNodeId}
            </button>
          </>
        ) : (
          <div style={{ color: '#3a5060', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.7 }}>
            <b style={{ color: '#4a6070' }}>Click</b> node — select<br />
            <b style={{ color: '#4a6070' }}>Alt+click</b> node — set process<br />
            <b style={{ color: '#4a6070' }}>Shift+drag</b> node→node — connect<br />
            <b style={{ color: '#4a6070' }}>Shift+click</b> edge — delete edge<br />
            <b style={{ color: '#4a6070' }}>Ctrl+drag</b> — snap to grid<br />
            <b style={{ color: '#4a6070' }}>Delete</b> — remove selected
          </div>
        )}

        <div style={{ flex: 1 }} />

        {error && (
          <div style={{ color: '#d46060', fontSize: 11, fontFamily: 'monospace', marginBottom: 8 }}>
            {error}
          </div>
        )}
        {saveStatus !== 'idle' && (
          <div style={{
            fontSize: 11, fontFamily: 'monospace', textAlign: 'center', padding: '4px 0',
            color: saveStatus === 'saving' ? '#4a6070' : saveStatus === 'saved' ? '#37abc8' : '#d46060',
          }}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}
          </div>
        )}
      </div>

      {/* Canvas */}
      <TopologyCanvas
        routers={topo.routers}
        links={topo.links}
        positions={positions}
        processSet={processSet}
        selectedNodeId={selectedNodeId}
        onNodeSelect={setSelectedNodeId}
        onAddNode={handleAddNode}
        onDeleteNode={handleDeleteNode}
        onAddLink={handleAddLink}
        onDeleteLink={handleDeleteLink}
        onPositionChange={handlePositionChange}
        onEdgeOffsetChange={setEdgeOffsets}
        onProcessChange={handleProcessChange}
        edgeOffsets={edgeOffsets}
        nextLetter={next}
      />
    </div>
  );
}
