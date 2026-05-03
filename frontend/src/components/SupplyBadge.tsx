import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MATERIAL_COLORS, MATERIAL_NAMES } from '../constants';
import { api } from '../api/client';
import type { StorageHistoryEntry } from '../types/game';

interface Props {
  materialId: string;
  count: number;
  capacity: number;
  isOutput: boolean;
  nodeId?: string;
  roundId?: number;
  timeMs?: number;
}

function fillPct(count: number): number {
  return Math.min(count / 30, 1) * 100;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function SupplyBadge({ materialId, count, nodeId, roundId, timeMs }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<StorageHistoryEntry[] | null>(null);

  const hex = MATERIAL_COLORS[materialId] ?? '#888888';
  const name = MATERIAL_NAMES[materialId] ?? materialId;

  const pct = fillPct(count);
  const isOverflow = count > 30;
  const background = `linear-gradient(to top, ${hex} ${pct}%, #000 ${pct}%)`;

  const handleMouseEnter = () => {
    if (!ref.current || nodeId == null || roundId == null || timeMs == null) return;
    const rect = ref.current.getBoundingClientRect();
    setPopupPos({ x: rect.right + 8, y: rect.top });
    setHistory(null);
    api.getStorageHistory(roundId, nodeId, materialId, timeMs).then(setHistory).catch(() => setHistory([]));
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setPopupPos(null); setHistory(null); }}
        title={`${name}: ${count}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background,
          color: '#fff',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          minWidth: 22,
          height: 18,
          padding: '0 4px',
          lineHeight: 1,
          boxShadow: isOverflow ? `0 0 5px 1px ${hex}` : 'none',
          border: `2px solid ${hex}`,
          boxSizing: 'border-box',
          cursor: nodeId != null && roundId != null ? 'default' : undefined,
        }}
      >
        {count}
      </span>
      {popupPos && createPortal(
        <div style={{
          position: 'fixed',
          top: popupPos.y,
          left: popupPos.x,
          background: '#1e2530',
          border: '1px solid #3a4a5a',
          borderRadius: 6,
          zIndex: 9999,
          pointerEvents: 'none',
          minWidth: 190,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontFamily: 'monospace',
        }}>
          <div style={{
            padding: '5px 8px',
            borderBottom: '1px solid #2a3a4a',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
          }}>
            <span style={{ color: '#e0eaf0', fontWeight: 700 }}>{nodeId}</span>
            <span style={{ color: '#3a4a5a' }}>:</span>
            <span style={{ color: hex, fontWeight: 700 }}>{name}</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '3px 0' }}>
            {history === null ? (
              <div style={{ padding: '4px 8px', color: '#4a6070', fontSize: 11 }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ padding: '4px 8px', color: '#4a6070', fontSize: 11 }}>No deliveries</div>
            ) : history.map((entry, i) => (
              <div key={i} style={{
                padding: '2px 8px',
                display: 'flex',
                gap: 5,
                fontSize: 11,
                color: '#c8dce8',
              }}>
                <span style={{ color: '#566878', minWidth: 35 }}>{formatMs(entry.time_ms)}</span>
                <span style={{ color: '#3a4a5a' }}>:</span>
                <span style={{ color: hex, minWidth: 24 }}>+{entry.delta}</span>
                <span style={{ color: '#3a4a5a' }}>:</span>
                <span style={{ color: '#8a9aaa' }}>{entry.card_id}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
