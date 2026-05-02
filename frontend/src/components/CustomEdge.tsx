import { useRef, useCallback } from 'react';
import { useStore } from 'reactflow';
import type { EdgeProps } from 'reactflow';

export interface CustomEdgeData {
  offsetX: number;
  offsetY: number;
  onControlChange: (edgeId: string, ox: number, oy: number) => void;
}

export function CustomEdge({ id, source, target, data }: EdgeProps<CustomEdgeData>) {
  // All hooks before any conditional return
  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));
  const zoom = useStore((s) => s.transform[2]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const dataRef = useRef(data);
  dataRef.current = data;

  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  // Stable drag handler — reads current values from refs, never goes stale
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      e.stopPropagation();
      e.preventDefault();
      startPos.current = { x: e.clientX, y: e.clientY };
      startOffset.current = {
        x: dataRef.current?.offsetX ?? 0,
        y: dataRef.current?.offsetY ?? 0,
      };

      const onMove = (me: MouseEvent) => {
        const dx = (me.clientX - startPos.current.x) / zoomRef.current;
        const dy = (me.clientY - startPos.current.y) / zoomRef.current;
        dataRef.current?.onControlChange(
          id,
          startOffset.current.x + dx,
          startOffset.current.y + dy,
        );
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [id],
  );

  if (!sourceNode || !targetNode) return null;

  // Anchor at horizontal center + vertical middle of the letter row.
  // Node width is fixed (88px in StationNode), so width/2 is a constant and x never drifts.
  // 18px = border(2) + padding-top(6) + half-letter-row(9.6) — stable regardless of badge count.
  const anchorY = 18;
  const sx = sourceNode.position.x + (sourceNode.width ?? 88) / 2;
  const sy = sourceNode.position.y + anchorY;
  const tx = targetNode.position.x + (targetNode.width ?? 88) / 2;
  const ty = targetNode.position.y + anchorY;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const ox = data?.offsetX ?? 0;
  const oy = data?.offsetY ?? 0;

  // Control point: C = mid + 2*offset  (so the arc visually passes through mid+offset at t=0.5)
  const cx = midX + 2 * ox;
  const cy = midY + 2 * oy;

  const path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

  return (
    <g>
      {/* Wide invisible hit area — the draggable surface */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
      />
      {/* Visible arc — pointer-events off so hover/drag targets the hit area only */}
      <path d={path} stroke="#4a6070" strokeWidth={2} fill="none" style={{ pointerEvents: 'none' }} />
    </g>
  );
}
