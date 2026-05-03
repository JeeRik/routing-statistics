import { MATERIAL_COLORS, MATERIAL_NAMES } from '../constants';

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

interface Props {
  materialId: string;
  amount: number;
}

export function TruckBadge({ materialId, amount }: Props) {
  const hex = MATERIAL_COLORS[materialId] ?? '#888888';
  const name = MATERIAL_NAMES[materialId] ?? materialId;
  const background = blendWithBlack(hex, fillRatio(amount));
  const textColor = materialId === '7' && amount >= TRUCK_CAPACITY ? '#333' : '#fff';

  return (
    <span
      title={`${name} truck: ${amount}/${TRUCK_CAPACITY}`}
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
      }}
    >
      {amount}
    </span>
  );
}
