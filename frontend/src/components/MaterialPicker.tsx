import { MATERIAL_COLORS } from '../constants';

const CELL = 22;
const GAP  = 12;
const STRIDE = CELL + GAP;
const GRID_SIZE = 2 * STRIDE + CELL; // 3 cells + 2 gaps

// Fixed grid layout — top row = tier-3, middle = tier-2, bottom = raw
const GRID_ROWS: { id: string; label: string }[][] = [
  [
    { id: '9', label: 'Brown'  },
    { id: '5', label: 'Red'    },
    { id: '3', label: 'Purple' },
  ],
  [
    { id: '1', label: 'Gray'   },
    { id: '4', label: 'Pink'   },
    { id: '6', label: 'Orange' },
  ],
  [
    { id: '2', label: 'Blue'   },
    { id: '7', label: 'Yellow' },
    { id: '8', label: 'Green'  },
  ],
];

// Map each material ID to the pixel center of its cell
const ID_TO_POS: Record<string, { x: number; y: number }> = {};
GRID_ROWS.forEach((row, ri) =>
  row.forEach((m, ci) => {
    ID_TO_POS[m.id] = { x: ci * STRIDE + CELL / 2, y: ri * STRIDE + CELL / 2 };
  }),
);

export interface MaterialLink {
  input: string;   // material ID
  output: string;  // material ID
}

interface Props {
  value: string;
  onChange?: (materialId: string) => void;
  links?: MaterialLink[];
  disabledIds?: string[];
}

export function MaterialPicker({ value, onChange = undefined, links = [], disabledIds = [] }: Props) {
  const interactive = onChange !== undefined;
  return (
    <div style={{ position: 'relative', width: GRID_SIZE, height: GRID_SIZE }}>
      {/* Dependency lines — rendered first so buttons sit on top */}
      <svg
        width={GRID_SIZE}
        height={GRID_SIZE}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {links.map(({ input, output }, i) => {
          const from = ID_TO_POS[input];
          const to   = ID_TO_POS[output];
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              stroke="#bbbbbb"
              strokeWidth={3}
              strokeLinecap="square"
              shapeRendering="crispEdges"
            />
          );
        })}
      </svg>

      {/* Color swatches */}
      {GRID_ROWS.map((row, ri) =>
        row.map((m, ci) => {
          const disabled = disabledIds.includes(m.id);
          return (
            <button
              key={m.id}
              title={m.label}
              onClick={(interactive && !disabled) ? () => onChange!(m.id) : undefined}
              style={{
                position: 'absolute',
                left: ci * STRIDE,
                top:  ri * STRIDE,
                width: CELL,
                height: CELL,
                borderRadius: 4,
                background: MATERIAL_COLORS[m.id],
                border: value === m.id ? '2px solid #fff' : '2px solid transparent',
                cursor: (interactive && !disabled) ? 'pointer' : 'default',
                padding: 0,
                pointerEvents: (interactive && !disabled) ? undefined : 'none',
                opacity: disabled ? 0.2 : 1,
                transform: value === m.id ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.1s, border-color 0.1s',
              }}
            />
          );
        }),
      )}
    </div>
  );
}
