import React, { useState, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { SupplyBadge } from './SupplyBadge';
import { TruckBadge } from './TruckBadge';
import type { StationState } from '../types/game';
import { MATERIAL_COLORS, MATERIAL_NAMES } from '../constants';

export interface TruckBubble {
  id: string;
  materialId: string;
  amount: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function ProcessChip({ id }: { id: string }) {
  return (
    <span style={{
      background: MATERIAL_COLORS[id] ?? '#888',
      color: id === '7' ? '#333' : '#fff',
      borderRadius: 4,
      padding: '1px 5px',
      fontSize: 11,
      fontWeight: 700,
      fontFamily: 'monospace',
    }}>
      {MATERIAL_NAMES[id] ?? id}
    </span>
  );
}

export interface StationNodeData {
  label: string;
  letter: string;
  state?: StationState;
  processDef?: { inputs: string[]; outputs: string[] };
  materialCapacities?: Record<string, number>;
  showSupply?: boolean;
  trucks?: TruckBubble[];
  showCargo?: boolean;
  roundId?: number;
  timeMs?: number;
  showDistribution?: boolean;
  distMaterialId?: string;
  distDelivered?: number;
  distTaxed?: number;
}

function nodeBackground(materialId: string | undefined, hasProcess: boolean): string {
  if (hasProcess && !materialId) {
    return 'radial-gradient(ellipse at center, #677f9c 0%, #141c28 100%)';
  }
  if (!materialId) return '#0a0f14';
  const hex = MATERIAL_COLORS[materialId];
  if (!hex) return '#1e2530';
  const br = 0x1e, bg = 0x25, bb = 0x30;
  const mr = parseInt(hex.slice(1, 3), 16);
  const mg = parseInt(hex.slice(3, 5), 16);
  const mb = parseInt(hex.slice(5, 7), 16);
  const t = 0.12;
  const r = Math.round(br * (1 - t) + mr * t);
  const g = Math.round(bg * (1 - t) + mg * t);
  const b = Math.round(bb * (1 - t) + mb * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function StationNode({ data }: NodeProps<StationNodeData>) {
  const nameRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = () => {
    if (nameRef.current) {
      const rect = nameRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.right + 8, y: rect.top });
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        background: nodeBackground(data.processDef?.outputs[0], !!data.processDef),
        border: '2px solid #3a4a5a',
        borderRadius: 8,
        padding: '6px 10px',
        width: 105,
        textAlign: 'center',
        fontFamily: 'monospace',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        ref={nameRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltipPos(null)}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0eaf0', lineHeight: 1.2 }}>
          {data.letter}
        </div>
        {data.label !== data.letter && (
          <div style={{ fontSize: 10, color: '#8a9aaa', marginBottom: 2 }}>{data.label}</div>
        )}
      </div>
      {tooltipPos && data.processDef && createPortal(
        <div style={{
          position: 'fixed',
          top: tooltipPos.y,
          left: tooltipPos.x,
          background: '#1e2530',
          border: '1px solid #3a4a5a',
          borderRadius: 6,
          padding: '6px 8px',
          zIndex: 9999,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {data.processDef.inputs.map((id, i) => (
              <Fragment key={id}>
                {i > 0 && <span style={{ color: '#6a8090' }}>+</span>}
                <ProcessChip id={id} />
              </Fragment>
            ))}
            {data.processDef.inputs.length > 0 && (
              <span style={{ color: '#6a8090' }}>→</span>
            )}
            {data.processDef.outputs.map((id) => (
              <ProcessChip key={id} id={id} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#6a8090' }}>
            {data.processDef.outputs.reduce((sum, id) => sum + (data.state?.produced?.[id] ?? 0), 0)} produced
          </div>
        </div>,
        document.body,
      )}
      {data.showSupply && data.processDef && (
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {data.processDef.inputs.map((id) => (
              <SupplyBadge
                key={id}
                materialId={id}
                count={data.state?.stock[id] ?? 0}
                capacity={data.materialCapacities?.[id] ?? 30}
                isOutput={false}
                nodeId={data.letter}
                roundId={data.roundId}
                timeMs={data.timeMs}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {data.processDef.outputs.map((id) => (
              <SupplyBadge
                key={id}
                materialId={id}
                count={data.state?.stock[id] ?? 0}
                capacity={data.materialCapacities?.[id] ?? 30}
                isOutput={true}
                nodeId={data.letter}
                roundId={data.roundId}
                timeMs={data.timeMs}
              />
            ))}
          </div>
        </div>
      )}
      {data.showDistribution && data.distMaterialId && (() => {
        const matId = data.distMaterialId;
        const isProducer = data.processDef?.outputs.includes(matId) ?? false;
        const isConsumer = data.processDef?.inputs.includes(matId) ?? false;
        const produced  = data.state?.produced?.[matId] ?? 0;
        const delivered = data.distDelivered ?? 0;
        const taxed     = data.distTaxed ?? 0;

        const matColor = MATERIAL_COLORS[matId] ?? '#c8dce8';
        const rowStyle: React.CSSProperties = {
          marginTop: 4,
          fontSize: 11,
          fontFamily: 'monospace',
          color: matColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          minHeight: 18,
        };
        const gearStyle:  React.CSSProperties = { fontSize: 13, lineHeight: 1, color: '#93a7ac' };
        const truckStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1, color: '#37abc8' };
        const stopStyle:  React.CSSProperties = { fontSize: 13, lineHeight: 1, color: '#d40000' };
        const dimStyle: React.CSSProperties = { color: '#6a8090' };

        if (isProducer) return (
          <div style={rowStyle}>
            <span className="material-icons" style={gearStyle}>settings</span>
            +{produced}
          </div>
        );
        if (isConsumer) return (
          <div style={rowStyle}>
            <span className="material-icons" style={truckStyle}>local_shipping</span>
            -{delivered}
            <span style={dimStyle}>/</span>
            <span className="material-icons" style={stopStyle}>block</span>
            -{taxed}
          </div>
        );
        if (taxed > 0) return (
          <div style={rowStyle}>
            <span className="material-icons" style={stopStyle}>block</span>
            -{taxed}
          </div>
        );
        return <div style={{ minHeight: 18, marginTop: 4 }} />;
      })()}
      {data.showCargo && data.trucks && data.trucks.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {chunkArray(data.trucks, 4).map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: i > 0 ? 2 : 0 }}>
              {row.map((t) => (
                <TruckBadge key={t.id} materialId={t.materialId} amount={t.amount} truckId={t.id} roundId={data.roundId} timeMs={data.timeMs} />
              ))}
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
