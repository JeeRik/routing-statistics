import { MATERIAL_COLORS, MATERIAL_NAMES } from '../constants';

interface Props {
  materialId: string;
  count: number;
}

export function StockBadge({ materialId, count }: Props) {
  const color = MATERIAL_COLORS[materialId] ?? '#888';
  const name = MATERIAL_NAMES[materialId] ?? materialId;
  const textColor = materialId === '7' ? '#333' : '#fff'; // yellow needs dark text

  return (
    <span
      title={`${name}: ${count}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color,
        color: textColor,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        minWidth: 22,
        height: 18,
        padding: '0 4px',
        margin: '0 1px',
        lineHeight: 1,
      }}
    >
      {count}
    </span>
  );
}
