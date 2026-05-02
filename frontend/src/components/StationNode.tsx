import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { StockBadge } from './StockBadge';
import type { StationState } from '../types/game';

export interface StationNodeData {
  label: string;
  letter: string;
  state?: StationState;
}

export function StationNode({ data }: NodeProps<StationNodeData>) {
  const stockEntries = Object.entries(data.state?.stock ?? {}).filter(([, v]) => v > 0);

  return (
    <div
      style={{
        background: '#1e2530',
        border: '2px solid #3a4a5a',
        borderRadius: 8,
        padding: '6px 10px',
        minWidth: 64,
        textAlign: 'center',
        fontFamily: 'monospace',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0eaf0', lineHeight: 1.2 }}>
        {data.letter}
      </div>
      {data.label !== data.letter && (
        <div style={{ fontSize: 10, color: '#8a9aaa', marginBottom: 2 }}>{data.label}</div>
      )}
      {stockEntries.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
          {stockEntries.map(([matId, count]) => (
            <StockBadge key={matId} materialId={matId} count={count} />
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
