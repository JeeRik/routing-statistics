import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setCookie } from '../utils/cookies';
import { api } from '../api/client';
import type { NodePosition, RouterDef, TopologyData } from '../types/game';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { detectProcessSet, findMatchingSet, matchesProcessSet, processOutputColor, MATERIAL_NAME_COLORS } from '../data/processSets';
import type { ProcessSet } from '../data/processSets';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ROCKET_PROCESS = {
  inputs: { brown: 2, red: 6, purple: 8 },
  outputs: {} as Record<string, number>,
  duration: 2,
};

function rocketDefaults(set: ProcessSet): { brown: number; red: number; purple: number } {
  const r = set.processes['factory_rocket'];
  return { brown: r?.inputs?.brown ?? 2, red: r?.inputs?.red ?? 6, purple: r?.inputs?.purple ?? 8 };
}

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

  const [processSets, setProcessSets] = useState<ProcessSet[]>([]);
  const [processSetKey, setProcessSetKey] = useState('full');
  const CUSTOM_KEY = '-custom-';
  const processSet: ProcessSet = processSetKey === CUSTOM_KEY
    ? { key: CUSTOM_KEY, name: CUSTOM_KEY, processes: topo.processes as ProcessSet['processes'], materials: topo.materials as ProcessSet['materials'] }
    : (processSets.find((s) => s.key === processSetKey) ?? processSets[processSets.length - 1]);

  const [topo, setTopo] = useState<TopologyData>(() => ({
    roundId: 0, roundName: 'New topology', duration: 720,
    processes: {}, materials: {}, routers: {}, links: [], events: [], editor_positions: {},
  }));
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [edgeOffsets, setEdgeOffsets] = useState<Record<string, { ox: number; oy: number }>>({});
  const [winCondition, setWinCondition] = useState<{ brown: number; red: number; purple: number }>(() => ({ brown: 2, red: 6, purple: 8 }));
  const winConditionRef = useRef<{ brown: number; red: number; purple: number }>({ brown: 2, red: 6, purple: 8 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => { winConditionRef.current = winCondition; }, [winCondition]);

  const loadProcessSets = useCallback(() => {
    api.getProcessSets().then(setProcessSets).catch(() => {});
  }, []);

  useEffect(() => { loadProcessSets(); }, [loadProcessSets]);

  // Apply default process set once loaded (new topologies only)
  useEffect(() => {
    if (!isNew || processSets.length === 0) return;
    const def = processSets.find((s) => s.key === 'full') ?? processSets[processSets.length - 1];
    setProcessSetKey(def.key);
    setTopo((prev) => ({ ...prev, processes: def.processes, materials: def.materials }));
    setWinCondition(rocketDefaults(def));
  }, [processSets, isNew]);

  // Stored process_set key from the topology file, available once topology load completes.
  // undefined = not yet loaded; '' = no key stored; string = stored key
  const storedKeyRef = useRef<string | undefined>(undefined);
  const keyDeterminedRef = useRef(false);

  // Once both topology and process sets are loaded, determine the correct key exactly once.
  useEffect(() => {
    if (isNew || !loaded || processSets.length === 0 || keyDeterminedRef.current) return;
    if (storedKeyRef.current === undefined) return; // topology fetch not yet complete
    keyDeterminedRef.current = true;
    const stored = storedKeyRef.current;
    if (stored && stored !== CUSTOM_KEY) {
      const storedSet = processSets.find((s) => s.key === stored);
      if (storedSet && matchesProcessSet(topo.processes, storedSet)) {
        setProcessSetKey(stored);
        return;
      }
    }
    const matched = findMatchingSet(topo.processes, processSets);
    setProcessSetKey(matched ?? CUSTOM_KEY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, processSets]);

  const zoomRef = useRef<number>(1);
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
      if (data.editor_win_condition) {
        setWinCondition(data.editor_win_condition as { brown: number; red: number; purple: number });
      } else if ((data.processes as Record<string, { inputs?: Record<string, number> }>)?.factory_rocket?.inputs) {
        const inp = (data.processes as Record<string, { inputs: Record<string, number> }>).factory_rocket.inputs;
        setWinCondition({ brown: inp.brown ?? 2, red: inp.red ?? 6, purple: inp.purple ?? 8 });
      }
      setEdgeOffsets((data.editor_edge_offsets ?? {}) as Record<string, { ox: number; oy: number }>);
      storedKeyRef.current = data.editor_process_set ?? '';
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
    const newSet = processSets.find((s) => s.key === key);
    if (!newSet) return;
    setProcessSetKey(key);
    setWinCondition(rocketDefaults(newSet));
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
        processes = { ...processes, factory_rocket: { ...ROCKET_PROCESS, inputs: winConditionRef.current } };
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
        const procs = 'factory_rocket' in topo.processes
          ? { ...topo.processes, factory_rocket: { ...topo.processes.factory_rocket, inputs: winCondition } }
          : topo.processes;
        const data: TopologyData = {
          ...topo,
          processes: procs,
          editor_positions: positions,
          editor_edge_offsets: edgeOffsets,
          editor_process_set: processSetKey === CUSTOM_KEY ? '' : processSetKey,
          editor_win_condition: winCondition,
        };
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
  }, [topo, positions, edgeOffsets, processSetKey, winCondition, loaded, isNew, topoId, navigate]);

  if (!loaded || !processSet) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6070' }}>
        Loading…
      </div>
    );
  }

  const selectedRouter = selectedNodeId ? topo.routers[selectedNodeId] : null;
  const next = nextUnusedLetter(topo.routers);

  function printTopology() {
    if (Object.keys(positions).length === 0) return;
    const NODE_W = 105, NODE_H = 50, PAD = 80;
    const xs = Object.values(positions).map((p) => p.x);
    const ys = Object.values(positions).map((p) => p.y);
    const minX = Math.min(...xs) - PAD, minY = Math.min(...ys) - PAD;
    const svgW = Math.max(...xs) + NODE_W + PAD - minX;
    const svgH = Math.max(...ys) + NODE_H + PAD - minY;

    const nodeFill = (letter: string): string => {
      const procName = topo.routers[letter]?.processes?.[0];
      if (!procName) return '#e8eef0';
      if (procName === 'factory_rocket') return '#888888';
      const outMat = Object.keys(topo.processes[procName]?.outputs ?? {})[0];
      return outMat ? (MATERIAL_NAME_COLORS[outMat] ?? '#cccccc') : '#cccccc';
    };
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const center = (l: string) => ({
      x: (positions[l]?.x ?? 0) + NODE_W / 2 - minX,
      y: (positions[l]?.y ?? 0) + NODE_H / 2 - minY,
    });
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const drawnEdges = new Set<string>();
    const edgeSvg = topo.links.map((link) => {
      const [a, b] = [link[0], link[1]];
      const key = [a, b].sort().join('-');
      if (drawnEdges.has(key)) return '';
      drawnEdges.add(key);
      if (!positions[a] || !positions[b]) return '';
      const sa = center(a), ta = center(b);
      const off = edgeOffsets[`${a}-${b}`] ?? edgeOffsets[`${b}-${a}`] ?? { ox: 0, oy: 0 };
      const ctrl = { x: (sa.x + ta.x) / 2 + off.ox * 1.5, y: (sa.y + ta.y) / 2 + off.oy * 1.5 };
      return `<path d="M ${sa.x} ${sa.y} Q ${ctrl.x} ${ctrl.y} ${ta.x} ${ta.y}" fill="none" stroke="#222" stroke-width="1.5"/>`;
    }).join('\n');

    const nodeSvg = Object.entries(topo.routers).map(([letter, router]) => {
      if (!positions[letter]) return '';
      const x = positions[letter].x - minX, y = positions[letter].y - minY;
      const fill = nodeFill(letter);
      const fg = lum(fill) > 0.45 ? '#000000' : '#ffffff';
      const hasLabel = router.label && router.label !== letter;
      return [
        `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8" ry="8" fill="${fill}" stroke="#222" stroke-width="1.5"/>`,
        `<text x="${x + NODE_W / 2}" y="${y + (hasLabel ? 21 : NODE_H / 2 + 6)}" text-anchor="middle" font-family="monospace" font-size="16" font-weight="700" fill="${fg}">${esc(letter)}</text>`,
        hasLabel ? `<text x="${x + NODE_W / 2}" y="${y + 38}" text-anchor="middle" font-family="monospace" font-size="10" fill="${fg}" opacity="0.75">${esc(router.label)}</text>` : '',
      ].join('');
    }).join('\n');

    // Process-set dependency preview (mirrors MaterialPicker grid)
    const MAT_NAME_TO_ID: Record<string, string> = {
      blue:'2', yellow:'7', green:'8', gray:'1',
      orange:'6', pink:'4', red:'5', purple:'3', brown:'9',
    };
    const ID_COLOR: Record<string, string> = {
      '1':'#93a7ac','2':'#37abc8','3':'#aa87de','4':'#d35f8d',
      '5':'#d40000','6':'#d45500','7':'#ffcc00','8':'#aad400','9':'#a05a2c',
    };
    const PC = 22, PG = 12, PS = PC + PG, PGRID = 2 * PS + PC;
    const PICK_ROWS = [['9','5','3'],['1','4','6'],['2','7','8']];
    const PPOS: Record<string, {x:number,y:number}> = {};
    PICK_ROWS.forEach((row, ri) => row.forEach((id, ci) => {
      PPOS[id] = { x: ci * PS + PC / 2, y: ri * PS + PC / 2 };
    }));
    const activeMats = new Set<string>();
    const seenLinks = new Set<string>();
    const depLinesSvg: string[] = [];
    for (const proc of Object.values(topo.processes)) {
      const ins = Object.keys(proc.inputs ?? {}), outs = Object.keys(proc.outputs ?? {});
      for (const m of [...ins, ...outs]) { const id = MAT_NAME_TO_ID[m]; if (id) activeMats.add(id); }
      for (const inp of ins) for (const out of outs) {
        const iid = MAT_NAME_TO_ID[inp], oid = MAT_NAME_TO_ID[out];
        if (!iid || !oid) continue;
        const key = `${iid}-${oid}`;
        if (seenLinks.has(key)) continue;
        seenLinks.add(key);
        const f = PPOS[iid], t = PPOS[oid];
        if (f && t) depLinesSvg.push(
          `<line x1="${f.x}" y1="${f.y}" x2="${t.x}" y2="${t.y}" stroke="#555" stroke-width="3" stroke-linecap="square" shape-rendering="crispEdges"/>`
        );
      }
    }
    const pickCellsSvg = PICK_ROWS.flatMap((row, ri) =>
      row.map((id, ci) => {
        const x = ci * PS, y = ri * PS;
        const col = ID_COLOR[id] ?? '#ccc';
        const op = activeMats.has(id) ? 1 : 0.12;
        return `<rect x="${x}" y="${y}" width="${PC}" height="${PC}" rx="4" ry="4" fill="${col}" stroke="white" stroke-width="1.5" opacity="${op}"/>`;
      })
    ).join('\n');
    const pickSvg = `<svg viewBox="0 0 ${PGRID} ${PGRID}" style="display:block;width:calc(100%/6);height:auto;margin:20px auto 0" xmlns="http://www.w3.org/2000/svg">
<rect width="${PGRID}" height="${PGRID}" fill="white"/>
${depLinesSvg.join('\n')}
${pickCellsSvg}
</svg>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(topo.roundName)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:white;padding:20px;font-family:monospace}h2{font-size:13px;color:#333;margin-bottom:12px}.topo-svg{display:block;width:100%;height:auto}@page{size:A4 portrait;margin:0}@media print{body{padding:15mm}}</style>
</head><body>
<h2>${esc(topo.roundName)}</h2>
<svg class="topo-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
<rect width="${svgW}" height="${svgH}" fill="white"/>
${edgeSvg}
${nodeSvg}
</svg>
${pickSvg}
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));</script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.addEventListener('unload', () => URL.revokeObjectURL(url));
  }

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
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value={processSetKey}
              onChange={(e) => handleProcessSetChange(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', flex: 1 }}
            >
              {processSetKey === CUSTOM_KEY && (
                <option value={CUSTOM_KEY} style={{ color: '#d46060' }}>— custom —</option>
              )}
              {processSets.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={loadProcessSets}
              title="Reload process sets from disk"
              style={{
                background: '#111820', color: '#4a6070',
                border: '1px solid #2a3a4a', borderRadius: 5,
                padding: '0 7px', fontSize: 14, cursor: 'pointer', flexShrink: 0,
              }}
            >
              ↺
            </button>
          </div>
        </div>

        {/* Win condition */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Win condition</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['brown', 'red', 'purple'] as const).map((mat) => (
              <div key={mat} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: MATERIAL_NAME_COLORS[mat] }} />
                  <span style={{ fontSize: 9, color: '#4a6070', fontFamily: 'monospace', textTransform: 'uppercase' }}>{mat}</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={winCondition[mat]}
                  onChange={(e) => setWinCondition((prev) => ({ ...prev, [mat]: parseInt(e.target.value) || 0 }))}
                  style={{ ...inputStyle, padding: '4px 6px', textAlign: 'center' }}
                />
              </div>
            ))}
          </div>
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
              const z = zoomRef.current;
              const ghost = document.createElement('div');
              Object.assign(ghost.style, {
                position: 'fixed', left: '-200px', top: '-200px',
                width: `${Math.round(105 * z)}px`, boxSizing: 'border-box',
                background: '#1e2530', border: `${Math.max(1, Math.round(2 * z))}px solid #3a4a5a`,
                borderRadius: `${Math.round(8 * z)}px`,
                padding: `${Math.round(6 * z)}px ${Math.round(10 * z)}px`,
                textAlign: 'center', fontFamily: 'monospace',
                color: '#e0eaf0', fontSize: `${Math.round(16 * z)}px`, fontWeight: '700',
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
                    background: processOutputColor(selectedRouter.processes[0], processSet?.processes ?? {}),
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
        <button
          onClick={printTopology}
          style={{
            width: '100%', background: 'rgba(55,171,200,0.12)', color: '#37abc8',
            border: '1px solid rgba(55,171,200,0.4)', borderRadius: 5,
            padding: '7px 10px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'monospace', marginBottom: 6, fontWeight: 600,
          }}
        >
          Print
        </button>
        <button
          onClick={() => setExportOpen(true)}
          style={{
            width: '100%', background: 'rgba(55,171,200,0.12)', color: '#37abc8',
            border: '1px solid rgba(55,171,200,0.4)', borderRadius: 5,
            padding: '7px 10px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'monospace', marginBottom: 8, fontWeight: 600,
          }}
        >
          Export JSON
        </button>
        {saveStatus !== 'idle' && (
          <div style={{
            fontSize: 11, fontFamily: 'monospace', textAlign: 'center', padding: '4px 0',
            color: saveStatus === 'saving' ? '#4a6070' : saveStatus === 'saved' ? '#37abc8' : '#d46060',
          }}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}
          </div>
        )}
      </div>

      {/* Export modal */}
      {exportOpen && (() => {
        const exportProcs = 'factory_rocket' in topo.processes
          ? { ...topo.processes, factory_rocket: { ...topo.processes.factory_rocket, inputs: winCondition } }
          : topo.processes;
        const exportData = { ...topo, processes: exportProcs, editor_positions: positions, editor_edge_offsets: edgeOffsets, editor_win_condition: winCondition };
        const json = JSON.stringify(exportData, null, 2);
        return (
          <div onClick={() => setExportOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: '#151d28', border: '1px solid #2a3a4a', borderRadius: 8,
              width: '60vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid #2a3a4a',
              }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6a8090' }}>{topo.roundName}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    ['Copy all', json],
                    ['Copy game data', JSON.stringify(
                      (({ editor_positions: _p, editor_edge_offsets: _o, editor_win_condition: _w, ...d }) => d)(exportData), null, 2
                    )],
                  ] as [string, string][]).map(([label, text]) => (
                    <button key={label} onClick={() => navigator.clipboard.writeText(text)} style={{
                      background: 'rgba(55,171,200,0.12)', border: '1px solid rgba(55,171,200,0.4)',
                      color: '#37abc8', borderRadius: 4, padding: '5px 14px',
                      fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600,
                    }}>{label}</button>
                  ))}
                  <button onClick={() => setExportOpen(false)} style={{
                    background: 'transparent', border: 'none', color: '#4a6070', fontSize: 16, cursor: 'pointer',
                  }}>✕</button>
                </div>
              </div>
              <pre style={{
                margin: 0, padding: '12px 16px', overflowY: 'auto', flex: 1,
                fontSize: 11, fontFamily: 'monospace', color: '#c8dce8', lineHeight: 1.6,
              }}>{json}</pre>
            </div>
          </div>
        );
      })()}

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
        zoomRef={zoomRef}
      />
    </div>
  );
}
