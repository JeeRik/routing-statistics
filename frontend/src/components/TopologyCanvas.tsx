import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { StationNode, type StationNodeData } from './StationNode';
import { CustomEdge, type CustomEdgeData } from './CustomEdge';
import { ProcessPicker } from './ProcessPicker';
import type { NodePosition, RouterDef } from '../types/game';
import type { ProcessSet } from '../data/processSets';
import { processOutputColor } from '../data/processSets';
import { MATERIAL_IDS } from '../constants';

const NODE_TYPES = { station: StationNode };
const EDGE_TYPES = { custom: CustomEdge };
const SNAP_GRID = 160;

export interface TopologyCanvasProps {
  routers: Record<string, RouterDef>;
  links: string[];
  positions: Record<string, NodePosition>;
  processSet: ProcessSet;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onAddNode: (letter: string, position: { x: number; y: number }) => void;
  onDeleteNode: (id: string) => void;
  onAddLink: (source: string, target: string) => void;
  onDeleteLink: (edgeId: string) => void;
  onPositionChange: (positions: Record<string, NodePosition>) => void;
  onEdgeOffsetChange: (edgeOffsets: Record<string, { ox: number; oy: number }>) => void;
  onProcessChange: (nodeId: string, processName: string | null) => void;
  edgeOffsets: Record<string, { ox: number; oy: number }>;
  nextLetter: string;
  zoomRef?: React.MutableRefObject<number>;
}

function processToNodeDef(processName: string | undefined, processSet: ProcessSet): StationNodeData['processDef'] {
  if (!processName) return undefined;
  const proc = processSet.processes[processName];
  if (!proc) return undefined;
  return {
    inputs: Object.keys(proc.inputs).map((name) => MATERIAL_IDS[name] ?? name),
    outputs: Object.keys(proc.outputs).map((name) => MATERIAL_IDS[name] ?? name),
  };
}

function buildEditorNodes(
  routers: Record<string, RouterDef>,
  positions: Record<string, NodePosition>,
  processSet: ProcessSet,
  selectedNodeId: string | null,
): Node<StationNodeData>[] {
  return Object.entries(routers).map(([letter, router]) => ({
    id: letter,
    type: 'station',
    position: positions[letter] ?? { x: 0, y: 0 },
    selected: letter === selectedNodeId,
    data: {
      letter,
      label: router.label,
      processDef: processToNodeDef(router.processes[0], processSet),
    },
  }));
}

function buildEditorEdges(
  links: string[],
  edgeOffsets: Record<string, { ox: number; oy: number }>,
  onControlChange: (edgeId: string, ox: number, oy: number) => void,
  onDelete: (edgeId: string) => void,
): Edge<CustomEdgeData>[] {
  const seen = new Set<string>();
  return links
    .map((link) => {
      const a = link[0], b = link[1];
      const key = [a, b].sort().join('-');
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: key,
        source: a,
        target: b,
        type: 'custom',
        data: {
          offsetX: edgeOffsets[key]?.ox ?? 0,
          offsetY: edgeOffsets[key]?.oy ?? 0,
          onControlChange,
          onDelete,
        },
      } as Edge<CustomEdgeData>;
    })
    .filter((e): e is Edge<CustomEdgeData> => e !== null);
}

interface ProcessPickerState {
  nodeId: string;
  x: number;
  y: number;
}

function TopologyCanvasInner({
  routers, links, positions, processSet, selectedNodeId,
  onNodeSelect, onAddNode, onDeleteNode, onAddLink, onDeleteLink,
  onPositionChange, onEdgeOffsetChange, onProcessChange, edgeOffsets, nextLetter, zoomRef,
}: TopologyCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<StationNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdgeData>([]);

  const edgeOffsetsRef = useRef(edgeOffsets);
  edgeOffsetsRef.current = edgeOffsets;

  // Ctrl key → snap to grid
  const [ctrlHeld, setCtrlHeld] = useState(false);
  // Shift key → connection drawing mode (disables node drag)
  const [shiftHeld, setShiftHeld] = useState(false);

  // Connection drawing state (via shift+drag on node)
  const connectingFromRef = useRef<string | null>(null);
  const connectingFromPos = useRef<{ x: number; y: number } | null>(null);
  const [connectingLine, setConnectingLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Process picker popup
  const [processPicker, setProcessPicker] = useState<ProcessPickerState | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Key tracking
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlHeld(true);
      if (e.key === 'Shift')   setShiftHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlHeld(false);
      if (e.key === 'Shift') {
        setShiftHeld(false);
        connectingFromRef.current = null;
        setConnectingLine(null);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Capture-phase mousedown on wrapper: Shift+click on a node starts connection drawing
  useEffect(() => {
    const div = wrapperRef.current;
    if (!div) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey) return;
      const nodeEl = (e.target as Element).closest('.react-flow__node');
      if (!nodeEl) return;
      const nodeId = nodeEl.getAttribute('data-id');
      if (!nodeId) return;
      e.stopPropagation();
      const rect = nodeEl.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      connectingFromRef.current = nodeId;
      connectingFromPos.current = { x: startX, y: startY };
      setConnectingLine({ x1: startX, y1: startY, x2: startX, y2: startY });
    };
    div.addEventListener('mousedown', onMouseDown, true);
    return () => div.removeEventListener('mousedown', onMouseDown, true);
  }, []);

  // Global mouse tracking for connection line + completion on mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!connectingFromRef.current) return;
      const from = connectingFromPos.current ?? { x: e.clientX, y: e.clientY };
      let x2 = e.clientX;
      let y2 = e.clientY;
      const hoverEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.react-flow__node');
      const hoverId = hoverEl?.getAttribute('data-id');
      if (hoverEl && hoverId && hoverId !== connectingFromRef.current) {
        const rect = hoverEl.getBoundingClientRect();
        x2 = rect.left + rect.width / 2;
        y2 = rect.top + rect.height / 2;
      }
      setConnectingLine({ x1: from.x, y1: from.y, x2, y2 });
    };
    const onUp = (e: MouseEvent) => {
      if (connectingFromRef.current) {
        const nodeEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.react-flow__node');
        const targetId = nodeEl?.getAttribute('data-id');
        if (targetId && targetId !== connectingFromRef.current) {
          onAddLink(connectingFromRef.current, targetId);
        }
      }
      connectingFromRef.current = null;
      connectingFromPos.current = null;
      setConnectingLine(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [onAddLink]);

  const handleControlChange = useCallback(
    (edgeId: string, ox: number, oy: number) => {
      const updated = { ...edgeOffsetsRef.current, [edgeId]: { ox, oy } };
      onEdgeOffsetChange(updated);
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data as CustomEdgeData), offsetX: ox, offsetY: oy } }
            : e,
        ),
      );
    },
    [setEdges, onEdgeOffsetChange],
  );

  const handleDeleteEdge = useCallback((edgeId: string) => {
    onDeleteLink(edgeId);
  }, [onDeleteLink]);

  // Rebuild nodes when props change
  useEffect(() => {
    setNodes(buildEditorNodes(routers, positions, processSet, selectedNodeId));
  }, [routers, positions, processSet, selectedNodeId, setNodes]);

  // Rebuild edges when links/offsets change
  useEffect(() => {
    setEdges(buildEditorEdges(links, edgeOffsets, handleControlChange, handleDeleteEdge));
  }, [links, edgeOffsets, handleControlChange, handleDeleteEdge, setEdges]);

  // Node click → open process picker near cursor
  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      setProcessPicker({ nodeId: node.id, x: e.clientX, y: e.clientY });
      onNodeSelect(node.id);
    },
    [onNodeSelect],
  );

  // Pane click → deselect + close picker
  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    setProcessPicker(null);
  }, [onNodeSelect]);

  // Drag-and-drop node creation
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.getData('application/x-topo-node')) return;
      e.preventDefault();
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onAddNode(nextLetter, pos);
    },
    [screenToFlowPosition, onAddNode, nextLetter],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-topo-node')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Node position changes
  const onNodesChangeWithPosition = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const hasFinalPos = changes.some((c) => c.type === 'position' && !c.dragging);
      if (!hasFinalPos) return;
      setNodes((current) => {
        const updated: Record<string, NodePosition> = {};
        current.forEach((n) => { updated[n.id] = n.position; });
        onPositionChange(updated);
        return current;
      });
    },
    [onNodesChange, setNodes, onPositionChange],
  );

  // Edge changes (delete key)
  const onEdgesChangeWithDelete = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      changes.forEach((c) => { if (c.type === 'remove') onDeleteLink(c.id); });
    },
    [onEdgesChange, onDeleteLink],
  );

  // Node delete (Delete key)
  const onNodesDelete = useCallback(
    (deleted: Node[]) => { deleted.forEach((n) => onDeleteNode(n.id)); },
    [onDeleteNode],
  );

  return (
    <div ref={wrapperRef} style={{ flex: 1, height: '100%', background: '#111820', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChangeWithPosition}
        onEdgesChange={onEdgesChangeWithDelete}
        onNodesDelete={onNodesDelete}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragStart={(e) => e.preventDefault()}
        onMove={(_, vp) => { if (zoomRef) zoomRef.current = vp.zoom; }}
        multiSelectionKeyCode={null}
        nodesDraggable={!shiftHeld}
        nodesConnectable={false}
        snapToGrid={!ctrlHeld}
        snapGrid={[SNAP_GRID, SNAP_GRID]}
        deleteKeyCode="Delete"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={3}
      >
        <Background color="#2a3a4a" gap={20} />
        <Controls />
        <ProcessLegend processSet={processSet} routers={routers} />
        {!ctrlHeld && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(55,171,200,0.15)', border: '1px solid rgba(55,171,200,0.4)',
            borderRadius: 6, padding: '4px 12px', color: '#37abc8', fontSize: 12,
            fontFamily: 'monospace', pointerEvents: 'none', zIndex: 10,
          }}>
            grid snap — {SNAP_GRID}px
          </div>
        )}
      </ReactFlow>

      {/* Connection line overlay */}
      {connectingLine && createPortal(
        <svg style={{
          position: 'fixed', inset: 0, width: '100vw', height: '100vh',
          pointerEvents: 'none', zIndex: 9980,
        }}>
          <line
            x1={connectingLine.x1} y1={connectingLine.y1}
            x2={connectingLine.x2} y2={connectingLine.y2}
            stroke="#37abc8" strokeWidth={2} strokeDasharray="6 3"
            strokeLinecap="round"
          />
          <circle cx={connectingLine.x2} cy={connectingLine.y2} r={4} fill="#37abc8" />
        </svg>,
        document.body,
      )}

      {/* Process picker popup */}
      {processPicker && (
        <ProcessPicker
          x={processPicker.x}
          y={processPicker.y}
          currentProcess={routers[processPicker.nodeId]?.processes[0] ?? null}
          processSet={processSet}
          onSelect={(p) => onProcessChange(processPicker.nodeId, p)}
          onClose={() => setProcessPicker(null)}
        />
      )}
    </div>
  );
}

function ProcessLegend({ processSet, routers }: { processSet: ProcessSet; routers: Record<string, RouterDef> }) {
  const counts: Record<string, number> = {};
  for (const r of Object.values(routers)) {
    const p = r.processes[0];
    if (p) counts[p] = (counts[p] ?? 0) + 1;
  }
  const total = Object.keys(routers).length;
  const unassigned = total - Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12,
      background: '#151d28', border: '1px solid #2a3a4a',
      borderRadius: 6, padding: '8px 10px',
      fontSize: 11, fontFamily: 'monospace', color: '#8a9aaa',
      zIndex: 10, minWidth: 160,
    }}>
      <div style={{ marginBottom: 6, color: '#c8dce8', fontWeight: 600 }}>
        Processes
        <span style={{ float: 'right', color: '#4a6070', fontWeight: 400 }}>{total} nodes</span>
      </div>
      {Object.keys(processSet.processes).map((name) => {
        const count = counts[name] ?? 0;
        return (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 2, flexShrink: 0,
              background: processOutputColor(name, processSet.processes),
            }} />
            <span style={{ color: '#c8dce8', flex: 1 }}>{name.replace('factory_', '')}</span>
            <span style={{ color: count > 0 ? '#37abc8' : '#2a3a4a', minWidth: 14, textAlign: 'right' }}>
              {count > 0 ? count : '–'}
            </span>
          </div>
        );
      })}
      {unassigned > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, paddingTop: 4, borderTop: '1px solid #2a3a4a' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: '#0a0f14', border: '1px solid #2a3a4a' }} />
          <span style={{ color: '#4a6070', flex: 1 }}>none</span>
          <span style={{ color: '#4a6070', minWidth: 14, textAlign: 'right' }}>{unassigned}</span>
        </div>
      )}
    </div>
  );
}

export function TopologyCanvas(props: TopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
