import type { ProcessDef } from '../types/game';

export interface ProcessSet {
  key: string;
  name: string;
  processes: Record<string, ProcessDef>;
  materials: Record<string, { capacity: number }>;
}

const ALL_PROCESSES: Record<string, ProcessDef> = {
  factory_blue:   { inputs: {},                              outputs: { blue: 1 },   duration: 4  },
  factory_yellow: { inputs: {},                              outputs: { yellow: 1 }, duration: 4  },
  factory_green:  { inputs: {},                              outputs: { green: 1 },  duration: 4  },
  factory_gray:   { inputs: { blue: 1, yellow: 1 },          outputs: { gray: 1 },   duration: 8  },
  factory_orange: { inputs: { yellow: 1, green: 1 },         outputs: { orange: 1 }, duration: 8  },
  factory_pink:   { inputs: { green: 1, blue: 1 },           outputs: { pink: 1 },   duration: 8  },
  factory_red:    { inputs: { gray: 1, orange: 1 },          outputs: { red: 1 },    duration: 15 },
  factory_purple: { inputs: { orange: 1, pink: 1 },          outputs: { purple: 1 }, duration: 15 },
  factory_brown:  { inputs: { pink: 1, gray: 1 },            outputs: { brown: 1 },  duration: 15 },
  factory_rocket: { inputs: { brown: 2, red: 6, purple: 8 }, outputs: {},             duration: 2  },
};

const ALL_MATERIALS: Record<string, { capacity: number }> = {
  blue:   { capacity: 30 },
  yellow: { capacity: 30 },
  green:  { capacity: 30 },
  gray:   { capacity: 20 },
  orange: { capacity: 20 },
  pink:   { capacity: 20 },
  red:    { capacity: 10 },
  purple: { capacity: 10 },
  brown:  { capacity: 10 },
};

export const PROCESS_SETS: ProcessSet[] = [
  {
    key: 'tier1',
    name: 'Tier 1 — Raw (blue/yellow/green)',
    processes: {
      factory_blue:   ALL_PROCESSES.factory_blue,
      factory_yellow: ALL_PROCESSES.factory_yellow,
      factory_green:  ALL_PROCESSES.factory_green,
    },
    materials: {
      blue:   ALL_MATERIALS.blue,
      yellow: ALL_MATERIALS.yellow,
      green:  ALL_MATERIALS.green,
    },
  },
  {
    key: 'tier1_2',
    name: 'Tier 1+2 — (blue–pink)',
    processes: {
      factory_blue:   ALL_PROCESSES.factory_blue,
      factory_yellow: ALL_PROCESSES.factory_yellow,
      factory_green:  ALL_PROCESSES.factory_green,
      factory_gray:   ALL_PROCESSES.factory_gray,
      factory_orange: ALL_PROCESSES.factory_orange,
      factory_pink:   ALL_PROCESSES.factory_pink,
    },
    materials: {
      blue:   ALL_MATERIALS.blue,
      yellow: ALL_MATERIALS.yellow,
      green:  ALL_MATERIALS.green,
      gray:   ALL_MATERIALS.gray,
      orange: ALL_MATERIALS.orange,
      pink:   ALL_MATERIALS.pink,
    },
  },
  {
    key: 'full',
    name: 'Full chain (blue–rocket)',
    processes: { ...ALL_PROCESSES },
    materials: { ...ALL_MATERIALS },
  },
];

export const PROCESS_SET_BY_KEY: Record<string, ProcessSet> = Object.fromEntries(
  PROCESS_SETS.map((s) => [s.key, s]),
);

// Color by output material name (for node tinting in the editor)
export const MATERIAL_NAME_COLORS: Record<string, string> = {
  blue:   '#37abc8',
  yellow: '#ffcc00',
  green:  '#aad400',
  gray:   '#93a7ac',
  orange: '#d45500',
  pink:   '#d35f8d',
  red:    '#d40000',
  purple: '#aa87de',
  brown:  '#a05a2c',
};

export function processOutputColor(processName: string): string {
  const proc = ALL_PROCESSES[processName];
  if (!proc) return '#4a6070';
  const outMat = Object.keys(proc.outputs)[0];
  return outMat ? (MATERIAL_NAME_COLORS[outMat] ?? '#4a6070') : '#4a6070';
}

export function detectProcessSet(processes: Record<string, unknown>): string {
  const keys = Object.keys(processes);
  if (keys.some((k) => ['factory_red', 'factory_purple', 'factory_brown', 'factory_rocket'].includes(k)))
    return 'full';
  if (keys.some((k) => ['factory_gray', 'factory_orange', 'factory_pink'].includes(k)))
    return 'tier1_2';
  return 'tier1';
}
