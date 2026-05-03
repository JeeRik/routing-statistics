import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MATERIAL_COLORS, MATERIAL_NAMES } from '../constants';
import { api } from '../api/client';
import type { TruckHistoryEntry } from '../types/game';

const TRUCK_CAPACITY = 5;

function blendWithBlack(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * ratio)}, ${Math.round(g * ratio)}, ${Math.round(b * ratio)})`;
}

function fillRatio(amount: number): number {
  if (amount >= TRUCK_CAPACITY) return 1.0;
  return 0.5 + ((amount - 1) / (TRUCK_CAPACITY - 1)) * 0.5;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  materialId: string;
  amount: number;
  truckId: string;
  roundId?: number;
  timeMs?: number;
}

export function TruckBadge({ materialId, amount, truckId, roundId, timeMs }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<TruckHistoryEntry[] | null>(null);

  const hex = MATERIAL_COLORS[materialId] ?? '#888888';
  const name = MATERIAL_NAMES[materialId] ?? materialId;
  const background = blendWithBlack(hex, fillRatio(amount));
  const textColor = materialId === '7' && amount >= TRUCK_CAPACITY ? '#333' : '#fff';

  const handleMouseEnter = () => {
    if (!ref.current || roundId == null || timeMs == null) return;
    const rect = ref.current.getBoundingClientRect();
    setPopupPos({ x: rect.right + 8, y: rect.top });
    setHistory(null);
    api.getTruckHistory(roundId, truckId, timeMs).then(setHistory).catch(() => setHistory([]));
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setPopupPos(null); setHistory(null); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background,
          color: textColor,
          borderRadius: 9,
          fontSize: 10,
          fontWeight: 700,
          minWidth: 18,
          height: 16,
          padding: '0 2px',
          lineHeight: 1,
          boxSizing: 'border-box',
          cursor: 'default',
        }}
      >
        {amount}
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
          minWidth: 180,
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
            <span style={{ color: '#6a8090' }}>Card Id:</span>
            <span style={{ color: '#e0eaf0', fontWeight: 700 }}>{truckId}</span>
            <span style={{ color: '#3a4a5a' }}>:</span>
            <span style={{ color: hex, fontWeight: 700 }}>{name}</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '3px 0' }}>
            {history === null ? (
              <div style={{ padding: '4px 8px', color: '#4a6070', fontSize: 11 }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ padding: '4px 8px', color: '#4a6070', fontSize: 11 }}>No entries</div>
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
                <span style={{ minWidth: 14, textAlign: 'center' }}>{entry.node}</span>
                <span style={{ color: '#3a4a5a' }}>:</span>
                <span style={{ color: entry.cargo > 0 ? hex : '#4a6070' }}>{entry.cargo}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
