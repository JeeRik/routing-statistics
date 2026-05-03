import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { SupplyBadge } from './SupplyBadge';
import type { StationState } from '../types/game';

export interface StationNodeData {
  label: string;
  letter: string;
  state?: StationState;
  processDef?: { inputs: string[]; outputs: string[] };
  materialCapacities?: Record<string, number>;
  showSupply?: boolean;
}

export function StationNode({ data }: NodeProps<StationNodeData>) {
  return (
    <div
      style={{
        background: '#1e2530',
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
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0eaf0', lineHeight: 1.2 }}>
        {data.letter}
      </div>
      {data.label !== data.letter && (
        <div style={{ fontSize: 10, color: '#8a9aaa', marginBottom: 2 }}>{data.label}</div>
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
              />
            ))}
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
