import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useStore,
  type Node,
  type Edge,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { StationNode, type StationNodeData } from './StationNode';
import { CustomEdge, type CustomEdgeData } from './CustomEdge';
import type { GameState, LayoutData, RoundDefinition } from '../types/game';
import { api } from '../api/client';

const NODE_TYPES = { station: StationNode };
const EDGE_TYPES = { custom: CustomEdge };

// Renders nothing; reads measured node sizes from the RF store and reports the max.
// Must be rendered inside <ReactFlow> to have store access.
function GridSizer({ onSize }: { onSize: (size: number) => void }) {
  const maxDim = useStore((s) => {
    let max = 80;
    s.nodeInternals.forEach((n) => {
      if (n.width) max = Math.max(max, n.width);
      if (n.height) max = Math.max(max, n.height);
    });
    return max;
  });
  useEffect(() => {
    onSize(Math.round(maxDim * 2));
  }, [maxDim, onSize]);
  return null;
}

interface Props {
  roundId: number;
  definition: RoundDefinition;
  gameState: GameState | null;
}

function circleLayout(letters: string[]): Record<string, { x: number; y: number }> {
  const n = letters.length;
  const radius = Math.max(200, n * 40);
  const positions: Record<string, { x: number; y: number }> = {};
  letters.forEach((letter, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions[letter] = {
      x: radius * Math.cos(angle) + radius,
      y: radius * Math.sin(angle) + radius,
    };
  });
  return positions;
}

function buildNodes(
  definition: RoundDefinition,
  positions: Record<string, { x: number; y: number }>,
  gameState: GameState | null,
): Node<StationNodeData>[] {
  return Object.entries(definition.routers).map(([letter, routerDef]) => ({
    id: letter,
    type: 'station',
    position: positions[letter] ?? { x: 0, y: 0 },
    data: { letter, label: routerDef.label, state: gameState?.stations[letter] },
  }));
}

function buildEdges(
  definition: RoundDefinition,
  edgeOffsets: Record<string, { ox: number; oy: number }>,
  onControlChange: (edgeId: string, ox: number, oy: number) => void,
): Edge<CustomEdgeData>[] {
  const seen = new Set<string>();
  return definition.links
    .map((link) => {
      const [a, b] = [link[0], link[1]];
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
        },
      } as Edge<CustomEdgeData>;
    })
    .filter((e): e is Edge<CustomEdgeData> => e !== null);
}

export function NetworkMap({ roundId, definition, gameState }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<StationNodeData>([]);
  const [edges, setEdges] = useEdgesState<CustomEdgeData>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const edgeOffsetsRef = useRef<Record<string, { ox: number; oy: number }>>({});

  const [snapActive, setSnapActive] = useState(false);
  const [gridSize, setGridSize] = useState(160);

  // Ctrl held → snap to grid
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') setSnapActive(true); };
    const onKeyUp   = (e: KeyboardEvent) => { if (e.key === 'Control') setSnapActive(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  const scheduleSave = useCallback((roundId_: number) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const layoutData: LayoutData = {
        positions: positionsRef.current,
        edge_offsets: edgeOffsetsRef.current,
      };
      api.saveLayout(roundId_, layoutData).catch(console.error);
    }, 500);
  }, []);

  const handleControlChange = useCallback(
    (edgeId: string, ox: number, oy: number) => {
      edgeOffsetsRef.current = { ...edgeOffsetsRef.current, [edgeId]: { ox, oy } };
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data as CustomEdgeData), offsetX: ox, offsetY: oy } }
            : e,
        ),
      );
      scheduleSave(roundId);
    },
    [setEdges, scheduleSave, roundId],
  );

  // Load layout and build graph on round/definition change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let positions: Record<string, { x: number; y: number }>;
      let edgeOffsets: Record<string, { ox: number; oy: number }> = {};
      try {
        const layout = await api.getLayout(roundId);
        positions = Object.fromEntries(
          Object.entries(layout.positions).map(([k, v]) => [k, { x: v.x, y: v.y }]),
        );
        edgeOffsets = Object.fromEntries(
          Object.entries(layout.edge_offsets ?? {}).map(([k, v]) => [k, { ox: v.ox, oy: v.oy }]),
        );
      } catch {
        positions = circleLayout(Object.keys(definition.routers));
      }
      if (cancelled) return;
      positionsRef.current = positions;
      edgeOffsetsRef.current = edgeOffsets;
      setNodes(buildNodes(definition, positions, null));
      setEdges(buildEdges(definition, edgeOffsets, handleControlChange));
    })();
    return () => { cancelled = true; };
  }, [roundId, definition, handleControlChange, setNodes, setEdges]);

  // Update node data when gameState changes without resetting positions
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: { ...node.data, state: gameState?.stations[node.id] },
      })),
    );
  }, [gameState, setNodes]);

  const onNodesChangeWithSave = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const positionChanges = changes.filter((c) => c.type === 'position' && !c.dragging);
      if (positionChanges.length === 0) return;

      setNodes((current) => {
        const updated: Record<string, { x: number; y: number }> = {};
        current.forEach((n) => { updated[n.id] = n.position; });
        positionsRef.current = updated;
        scheduleSave(roundId);
        return current;
      });
    },
    [onNodesChange, setNodes, scheduleSave, roundId],
  );

  return (
    <div style={{ flex: 1, height: '100%', background: '#111820' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChangeWithSave}
        snapToGrid={snapActive}
        snapGrid={[gridSize, gridSize]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={3}
      >
        <GridSizer onSize={setGridSize} />
        <Background color="#2a3a4a" gap={20} />
        <Controls />
        <MiniMap
          nodeColor="#3a4a5a"
          maskColor="rgba(0,0,0,0.4)"
          style={{ background: '#1a2530' }}
        />
        {snapActive && (
          <Panel
            position="top-center"
            style={{
              background: 'rgba(55,171,200,0.15)',
              border: '1px solid rgba(55,171,200,0.4)',
              borderRadius: 6,
              padding: '4px 12px',
              color: '#37abc8',
              fontSize: 12,
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}
          >
            grid snap — {gridSize}px
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
