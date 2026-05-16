import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ProcessSet } from '../data/processSets';
import { MaterialPicker, type MaterialLink } from './MaterialPicker';
import { MATERIAL_IDS } from '../constants';

// Bidirectional maps between factory process names and material IDs
const PROCESS_TO_MATID: Record<string, string> = {
  factory_gray: '1', factory_blue: '2', factory_purple: '3',
  factory_pink: '4', factory_red: '5', factory_orange: '6',
  factory_yellow: '7', factory_green: '8', factory_brown: '9',
};
const MATID_TO_PROCESS: Record<string, string> = Object.fromEntries(
  Object.entries(PROCESS_TO_MATID).map(([k, v]) => [v, k]),
);

// MaterialPicker internal constants (CELL=22, GAP=12, STRIDE=34, GRID_SIZE=90)
const PICKER_SIZE = 90;
const BUTTON_H = 22;

interface Props {
  x: number;
  y: number;
  currentProcess: string | null;
  processSet: ProcessSet;
  onSelect: (process: string | null) => void;
  onClose: () => void;
}

export function ProcessPicker({ x, y, currentProcess, processSet, onSelect, onClose }: Props) {
  const popW = PICKER_SIZE + 24;
  const popH = PICKER_SIZE + BUTTON_H + 24 + 8;
  const px = Math.min(x + 8, window.innerWidth  - popW - 8);
  const py = Math.min(y + 8, window.innerHeight - popH - 8);

  const links = useMemo((): MaterialLink[] => {
    const result: MaterialLink[] = [];
    for (const proc of Object.values(processSet.processes)) {
      const outs = Object.keys(proc.outputs).map((n) => MATERIAL_IDS[n] ?? n);
      const ins  = Object.keys(proc.inputs).map((n) => MATERIAL_IDS[n] ?? n);
      for (const out of outs)
        for (const inp of ins)
          result.push({ input: inp, output: out });
    }
    return result;
  }, [processSet]);

  const disabledIds = useMemo(
    () => Object.keys(MATID_TO_PROCESS).filter((id) => !(MATID_TO_PROCESS[id] in processSet.processes)),
    [processSet],
  );

  const selectedId = currentProcess ? (PROCESS_TO_MATID[currentProcess] ?? '') : '';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close if mouse leaves the area without ever entering the popup.
  // onMouseLeave handles the "entered then left" case; this catches the other one.
  useEffect(() => {
    let active = false;
    const timer = setTimeout(() => { active = true; }, 1000);
    const onMove = (e: MouseEvent) => {
      if (!active || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        onClose();
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => { clearTimeout(timer); document.removeEventListener('mousemove', onMove); };
  }, [onClose]);

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed', left: px, top: py, zIndex: 9991,
        background: '#151d28', border: '1px solid #2a3a4a',
        borderRadius: 8, padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        userSelect: 'none',
      }}
      onMouseLeave={onClose}
    >
      <MaterialPicker
        value={selectedId}
        onChange={(id) => { onSelect(MATID_TO_PROCESS[id] ?? null); onClose(); }}
        links={links}
        disabledIds={disabledIds}
      />

      {/* Rocket + None row */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button
          title="factory_rocket"
          onClick={() => { onSelect('factory_rocket'); onClose(); }}
          style={{
            flex: 1, height: BUTTON_H, borderRadius: 4,
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
            flex: 1, height: BUTTON_H, borderRadius: 4,
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
    </div>,
    document.body,
  );
}
