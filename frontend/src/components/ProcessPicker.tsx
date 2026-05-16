import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProcessSet } from '../data/processSets';
import { MATERIAL_NAME_COLORS } from '../data/processSets';

const CELL = 28;
const GAP = 6;
const STRIDE = CELL + GAP;

// Fixed 3×3 grid matching MaterialPicker tier layout (top = tier3, bottom = raw)
const PROCESS_GRID: { process: string; material: string }[][] = [
  [
    { process: 'factory_brown',  material: 'brown'  },
    { process: 'factory_red',    material: 'red'    },
    { process: 'factory_purple', material: 'purple' },
  ],
  [
    { process: 'factory_gray',   material: 'gray'   },
    { process: 'factory_pink',   material: 'pink'   },
    { process: 'factory_orange', material: 'orange' },
  ],
  [
    { process: 'factory_blue',   material: 'blue'   },
    { process: 'factory_yellow', material: 'yellow' },
    { process: 'factory_green',  material: 'green'  },
  ],
];

interface Props {
  x: number;
  y: number;
  currentProcess: string | null;
  processSet: ProcessSet;
  onSelect: (process: string | null) => void;
  onClose: () => void;
}

export function ProcessPicker({ x, y, currentProcess, processSet, onSelect, onClose }: Props) {
  const gridW = 3 * STRIDE - GAP;
  const gridH = 3 * STRIDE - GAP;
  const popW = gridW + 24;
  const popH = gridH + CELL + 24 + 8 + 28; // grid + bottom row + paddings
  const px = Math.min(x + 8, window.innerWidth  - popW - 8);
  const py = Math.min(y + 8, window.innerHeight - popH - 8);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      {/* Backdrop — click outside closes */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9990 }}
        onMouseDown={onClose}
      />
      <div
        style={{
          position: 'fixed', left: px, top: py, zIndex: 9991,
          background: '#151d28', border: '1px solid #2a3a4a',
          borderRadius: 8, padding: '10px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          userSelect: 'none',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 3×3 process grid */}
        <div style={{ position: 'relative', width: gridW, height: gridH }}>
          {PROCESS_GRID.map((row, ri) =>
            row.map(({ process, material }, ci) => {
              const inSet = process in processSet.processes;
              const active = currentProcess === process;
              const color = MATERIAL_NAME_COLORS[material] ?? '#555';
              return (
                <button
                  key={process}
                  title={process.replace('factory_', '')}
                  onClick={() => { onSelect(process); onClose(); }}
                  disabled={!inSet}
                  style={{
                    position: 'absolute',
                    left: ci * STRIDE,
                    top: ri * STRIDE,
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    background: color,
                    border: active ? '2px solid #fff' : '2px solid transparent',
                    cursor: inSet ? 'pointer' : 'default',
                    padding: 0,
                    opacity: inSet ? 1 : 0.2,
                    transform: active ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.1s, border-color 0.1s',
                    boxSizing: 'border-box',
                  }}
                />
              );
            }),
          )}
        </div>

        {/* Rocket + None row */}
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button
            title="factory_rocket"
            onClick={() => { onSelect('factory_rocket'); onClose(); }}
            style={{
              flex: 1, height: CELL, borderRadius: 4,
              background: currentProcess === 'factory_rocket' ? '#2a3a4a' : '#1e2a38',
              border: currentProcess === 'factory_rocket' ? '2px solid #fff' : '1px solid #3a4a5a',
              cursor: 'pointer', color: '#c8dce8', fontSize: 10,
              fontFamily: 'monospace',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxSizing: 'border-box',
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>rocket_launch</span>
            rocket
          </button>
          <button
            title="No process"
            onClick={() => { onSelect(null); onClose(); }}
            style={{
              flex: 1, height: CELL, borderRadius: 4,
              background: currentProcess === null ? '#2a3a4a' : '#1e2a38',
              border: currentProcess === null ? '2px solid #d46060' : '1px solid #3a4a5a',
              cursor: 'pointer', color: '#d46060', fontSize: 10,
              fontFamily: 'monospace',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxSizing: 'border-box',
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>block</span>
            none
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
