import { useRef, useCallback, useState } from 'react';
import { useStore } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import ReactDOM from 'react-dom';
import type { EdgeTraffic } from '../types/game';
import { MATERIAL_COLORS } from '../constants';

export interface CustomEdgeData {
  offsetX: number;
  offsetY: number;
  onControlChange: (edgeId: string, ox: number, oy: number) => void;
  trafficFwd?: EdgeTraffic | null;
  trafficBwd?: EdgeTraffic | null;
  maxGoods?: number;
  showTraffic?: boolean;
}

const TRAFFIC_YELLOW  = '#aa8800';
const TRAFFIC_ORANGE  = '#884400';
const MAIN_EDGE_HALF  = 1;   // half of the 2px main arc stroke
const MAX_EXTRA_WIDTH = 8;
const GRAD_PERIOD     = 60;  // px — one orange→yellow→orange cycle
const ANIM_DUR        = '1.2s';

function TrafficStrip({
  sx, sy, cx, cy, tx, ty,
  perp, sign,
  traffic, maxGoods,
  source, target, forward,
  gradientId,
}: {
  sx: number; sy: number; cx: number; cy: number; tx: number; ty: number;
  perp: { x: number; y: number };
  sign: number;
  traffic: EdgeTraffic;
  maxGoods: number;
  source: string; target: string; forward: boolean;
  gradientId: string;
}) {
  const [hover, setHover] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const ratio = Math.min(traffic.goods / Math.max(maxGoods, 1), 1);
  const strokeWidth = 2 + ratio * MAX_EXTRA_WIDTH;
  const maxStrokeWidth = 2 + MAX_EXTRA_WIDTH;

  // Visual strip — offset by actual width
  const d    = MAIN_EDGE_HALF + strokeWidth / 2;
  const px   = perp.x * d * sign;
  const py   = perp.y * d * sign;
  const path = `M ${sx + px} ${sy + py} Q ${cx + px} ${cy + py} ${tx + px} ${ty + py}`;

  // Hit area — always at max-width position so narrow strips are easy to hover
  const dHit    = MAIN_EDGE_HALF + maxStrokeWidth / 2;
  const pxHit   = perp.x * dHit * sign;
  const pyHit   = perp.y * dHit * sign;
  const hitPath = `M ${sx + pxHit} ${sy + pyHit} Q ${cx + pxHit} ${cy + pyHit} ${tx + pxHit} ${ty + pyHit}`;

  const from = forward ? source : target;
  const to   = forward ? target : source;

  return (
    <>
      {/* Visible strip — no pointer events */}
      <path
        d={path}
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeOpacity={0.9}
        fill="none"
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      {/* Transparent hit area — always max width */}
      <path
        d={hitPath}
        stroke="transparent"
        strokeWidth={maxStrokeWidth}
        fill="none"
        style={{ cursor: 'default', pointerEvents: 'stroke' }}
        onMouseEnter={(e) => { setHover(true); setMousePos({ x: e.clientX, y: e.clientY }); }}
        onMouseLeave={() => setHover(false)}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      />
      {hover && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          left: mousePos.x + 14,
          top: mousePos.y - 10,
          background: '#0e1620',
          border: '1px solid #2a3a4a',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#c8dce8',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          lineHeight: 1.6,
        }}>
          <div style={{ color: TRAFFIC_ORANGE, fontWeight: 700, marginBottom: 6 }}>
            {from} → {to}
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {Object.entries(traffic.by_material)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([matId, mat]) => (
                  <tr key={matId}>
                    <td style={{ paddingRight: 8, paddingBottom: 3 }}>
                      <div style={{
                        width: 12, height: 12,
                        background: MATERIAL_COLORS[matId] ?? '#888',
                        borderRadius: 2,
                        border: '1px solid rgba(255,255,255,0.15)',
                      }} />
                    </td>
                    <td style={{ paddingRight: 12, paddingBottom: 3, textAlign: 'right', color: '#8a9aaa' }}>
                      {mat.trips}
                    </td>
                    <td style={{ paddingBottom: 3, textAlign: 'right' }}>
                      {mat.goods}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </>
  );
}

export function CustomEdge({ id, source, target, data }: EdgeProps<CustomEdgeData>) {
  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));
  const zoom = useStore((s) => s.transform[2]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const dataRef = useRef(data);
  dataRef.current = data;

  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

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

  const anchorY = 18;
  const sx = sourceNode.position.x + (sourceNode.width ?? 88) / 2;
  const sy = sourceNode.position.y + anchorY;
  const tx = targetNode.position.x + (targetNode.width ?? 88) / 2;
  const ty = targetNode.position.y + anchorY;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const ox = data?.offsetX ?? 0;
  const oy = data?.offsetY ?? 0;

  const cx = midX + 2 * ox;
  const cy = midY + 2 * oy;

  const path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

  // Right-hand perpendicular in screen coords (Y-down): rotate direction 90° CCW → (-dy, dx)
  const ddx = tx - sx;
  const ddy = ty - sy;
  const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
  const perp = { x: -ddy / len, y: ddx / len };

  // Unit vector along path (source → target)
  const ux = ddx / len;
  const uy = ddy / len;

  const showTraffic = data?.showTraffic ?? false;
  const trafficFwd  = data?.trafficFwd;
  const trafficBwd  = data?.trafficBwd;
  const maxGoods    = data?.maxGoods ?? 1;

  const fwdGradId = `tg-${id}-f`;
  const bwdGradId = `tg-${id}-b`;

  // Gradient shift vectors: one full GRAD_PERIOD step along ±path direction
  const fwdTo = `${ux * GRAD_PERIOD} ${uy * GRAD_PERIOD}`;
  const bwdTo = `${-ux * GRAD_PERIOD} ${-uy * GRAD_PERIOD}`;

  return (
    <g>
      {showTraffic && (
        <defs>
          {/* Forward gradient: orange→yellow→orange tiling, slides source→target */}
          {trafficFwd && trafficFwd.goods > 0 && (
            <linearGradient id={fwdGradId} gradientUnits="userSpaceOnUse"
              x1={sx} y1={sy}
              x2={sx + ux * GRAD_PERIOD} y2={sy + uy * GRAD_PERIOD}
              spreadMethod="repeat">
              <stop offset="0%"   stopColor={TRAFFIC_ORANGE} />
              <stop offset="50%"  stopColor={TRAFFIC_YELLOW} />
              <stop offset="100%" stopColor={TRAFFIC_ORANGE} />
              <animateTransform attributeName="gradientTransform" type="translate"
                from="0 0" to={fwdTo} dur={ANIM_DUR} repeatCount="indefinite" />
            </linearGradient>
          )}
          {/* Backward gradient: slides target→source */}
          {trafficBwd && trafficBwd.goods > 0 && (
            <linearGradient id={bwdGradId} gradientUnits="userSpaceOnUse"
              x1={tx} y1={ty}
              x2={tx + (-ux) * GRAD_PERIOD} y2={ty + (-uy) * GRAD_PERIOD}
              spreadMethod="repeat">
              <stop offset="0%"   stopColor={TRAFFIC_ORANGE} />
              <stop offset="50%"  stopColor={TRAFFIC_YELLOW} />
              <stop offset="100%" stopColor={TRAFFIC_ORANGE} />
              <animateTransform attributeName="gradientTransform" type="translate"
                from="0 0" to={bwdTo} dur={ANIM_DUR} repeatCount="indefinite" />
            </linearGradient>
          )}
        </defs>
      )}

      {/* Traffic highlights — behind the main arc */}
      {showTraffic && trafficFwd && trafficFwd.goods > 0 && (
        <TrafficStrip
          sx={sx} sy={sy} cx={cx} cy={cy} tx={tx} ty={ty}
          perp={perp} sign={1}
          traffic={trafficFwd} maxGoods={maxGoods}
          source={source} target={target} forward={true}
          gradientId={fwdGradId}
        />
      )}
      {showTraffic && trafficBwd && trafficBwd.goods > 0 && (
        <TrafficStrip
          sx={sx} sy={sy} cx={cx} cy={cy} tx={tx} ty={ty}
          perp={perp} sign={-1}
          traffic={trafficBwd} maxGoods={maxGoods}
          source={source} target={target} forward={false}
          gradientId={bwdGradId}
        />
      )}

      {/* Wide invisible hit area — the draggable surface */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
      />
      {/* Visible arc */}
      <path d={path} stroke="#4a6070" strokeWidth={2} fill="none" style={{ pointerEvents: 'none' }} />
    </g>
  );
}
