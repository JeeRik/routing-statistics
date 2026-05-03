import { MATERIAL_COLORS, MATERIAL_NAMES } from '../constants';

interface Props {
  materialId: string;
  count: number;
  capacity: number;
  isOutput: boolean;
}

function blendWithBlack(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * ratio)}, ${Math.round(g * ratio)}, ${Math.round(b * ratio)})`;
}

function fillRatio(count: number, capacity: number): number {
  if (count === 0) return 0.25;
  if (capacity <= 1 || count >= capacity) return 1.0;
  // 1 item → 0.5, capacity → 1.0
  return 0.5 + ((count - 1) / (capacity - 1)) * 0.5;
}

export function SupplyBadge({ materialId, count, capacity, isOutput }: Props) {
  const hex = MATERIAL_COLORS[materialId] ?? '#888888';
  const name = MATERIAL_NAMES[materialId] ?? materialId;

  const ratio = fillRatio(count, capacity);
  const isOverflow = count > capacity;
  const isFull = count >= capacity;
  const background = blendWithBlack(hex, ratio);
  const textColor = materialId === '7' && isFull ? '#333' : '#fff';

  return (
    <span
      title={`${name}: ${count} / ${capacity}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        color: textColor,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        minWidth: 22,
        height: 18,
        padding: '0 4px',
        lineHeight: 1,
        boxShadow: isOverflow ? `0 0 5px 1px ${hex}` : 'none',
        border: isOutput ? '2px solid rgba(255,255,255,0.55)' : '2px solid transparent',
        boxSizing: 'border-box',
      }}
    >
      {count}
    </span>
  );
}
